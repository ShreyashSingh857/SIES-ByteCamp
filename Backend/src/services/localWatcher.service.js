import chokidar from 'chokidar';
import path from 'path';
import { enqueueWebhookJob } from '../queues/webhook.queue.js';

// Map of repoId -> chokidar FSWatcher instance
// Used to prevent duplicate watchers and to stop watching on demand
const activeWatchers = new Map();

/**
 * Start watching a local directory for file changes.
 * When a file is added, changed, or deleted, a job is enqueued into
 * the existing webhook.queue so the webhook.worker picks it up and
 * runs a partial AI Engine scan + SSE broadcast automatically.
 *
 * @param {string} repoId   - The repoId returned from the initial scan (e.g. "myproject-1234567-abc123")
 * @param {string} scanId   - The scanId returned from the Neo4j seed step (e.g. "scan-uuid-...")
 * @param {string} localPath - Absolute path to the local repo directory being watched
 */
export function startLocalWatch(repoId, scanId, localPath) {
  // Guard: never start a second watcher for the same repo
  if (activeWatchers.has(repoId)) {
    console.log(`[LocalWatcher] Already watching repoId=${repoId}, skipping.`);
    return;
  }

  const watcher = chokidar.watch(localPath, {
    // Ignore version control, dependencies, and build artifacts
    ignored: /(^|[/\\])(\.git|node_modules|dist|build|\.next|__pycache__|\.venv|venv)(\/|$)/,
    persistent: true,
    // Don't fire events for files that already existed when watch started
    ignoreInitial: true,
    // Wait until the file stops being written before firing (debounce for editors that write temp files)
    awaitWriteFinish: {
      stabilityThreshold: 400,
      pollInterval: 100,
    },
  });

  // Accumulate changed files within a short window to batch them into one job
  let pendingChanges = new Set();
  let pendingRemovals = new Set();
  let debounceTimer = null;

  const DEBOUNCE_MS = 800; // wait 800ms after last change before enqueuing

  function flush() {
    if (pendingChanges.size === 0 && pendingRemovals.size === 0) return;

    const changedFiles = [...pendingChanges].map((f) => path.relative(localPath, f));
    const removedFiles = [...pendingRemovals].map((f) => path.relative(localPath, f));

    pendingChanges.clear();
    pendingRemovals.clear();

    // Use a random jobId so every flush creates a fresh job (no deduplication suppression)
    enqueueWebhookJob(
      'repo-update',
      {
        repoId,
        scanId,
        localPath,
        branch: null,
        before: null,
        after: null,
        ref: null,
        changedFiles,
        removedFiles,
        isLocal: true, // <- CRITICAL FLAG: tells webhook.worker to skip git pull
      },
      {
        attempts: 2,
        backoffMs: 2000,
      }
    ).catch((err) => {
      console.error('[LocalWatcher] Failed to enqueue job:', err.message);
    });
  }

  function scheduleFlush() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(flush, DEBOUNCE_MS);
  }

  watcher
    .on('add', (filePath) => {
      pendingChanges.add(filePath);
      scheduleFlush();
    })
    .on('change', (filePath) => {
      pendingChanges.add(filePath);
      scheduleFlush();
    })
    .on('unlink', (filePath) => {
      pendingRemovals.add(filePath);
      scheduleFlush();
    })
    .on('error', (error) => console.error('[LocalWatcher] Watcher error:', error));

  activeWatchers.set(repoId, { watcher, debounceTimer });
  console.log(`[LocalWatcher] Started watching repoId=${repoId} at ${localPath}`);
}

/**
 * Stop watching a previously registered local repo.
 * Call this when the user removes a repo or the server shuts down.
 *
 * @param {string} repoId
 */
export function stopLocalWatch(repoId) {
  const entry = activeWatchers.get(repoId);
  if (!entry) return;

  clearTimeout(entry.debounceTimer);
  entry.watcher.close();
  activeWatchers.delete(repoId);
  console.log(`[LocalWatcher] Stopped watching repoId=${repoId}`);
}

/**
 * Stop all active watchers. Call during graceful shutdown.
 */
export function stopAllLocalWatchers() {
  for (const repoId of activeWatchers.keys()) {
    stopLocalWatch(repoId);
  }
}

/**
 * Returns true if a watcher is active for this repoId.
 *
 * @param {string} repoId
 * @returns {boolean}
 */
export function isWatching(repoId) {
  return activeWatchers.has(repoId);
}
