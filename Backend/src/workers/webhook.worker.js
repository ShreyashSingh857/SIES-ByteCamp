import fs from "fs/promises";
import path from "path";
import simpleGit from "simple-git";
import { execFile } from "child_process";
import { promisify } from "util";
import { fileURLToPath } from "url";
import { takeNextWebhookJob, completeWebhookJob, failWebhookJob } from "../queues/webhook.queue.js";
import { patchStoredGraph } from "../services/stored-graph-patch.service.js";
import { patchNeo4jGraph } from "../services/neo4j-patch.service.js";
import { broadcast } from "../services/sse.service.js";
import { AI_ENGINE_ENTRY, PROJECT_ROOT } from "../services/scan-workspace.service.js";

const execFileAsync = promisify(execFile);

let workerStarted = false;
let workerStopped = false;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPartialScan(localPath, changedFiles) {
  const files = Array.isArray(changedFiles) ? changedFiles.filter(Boolean) : [];
  if (files.length === 0) {
    return {
      repositoryPath: localPath,
      summary: {
        scannedFiles: 0,
        parsedFiles: 0,
        nodes: 0,
        edges: 0,
        languages: [],
      },
      nodes: [],
      edges: [],
    };
  }

  const tmpListPath = path.join(localPath, ".webhook-changed-files.json");
  try {
    await fs.writeFile(tmpListPath, JSON.stringify(files, null, 2), "utf8");
    const { stdout } = await execFileAsync(
      process.execPath,
      [AI_ENGINE_ENTRY, "--repo", localPath, "--files", tmpListPath],
      {
        cwd: PROJECT_ROOT,
        maxBuffer: 20 * 1024 * 1024,
      }
    );
    return JSON.parse(stdout);
  } finally {
    await fs.rm(tmpListPath, { force: true }).catch(() => {});
  }
}

async function updateRepository(localPath, { after, ref, branch }) {
  const git = simpleGit(localPath);

  if (ref) {
    await git.fetch("origin", ref);
  } else if (branch) {
    await git.fetch("origin", branch);
  } else {
    await git.fetch();
  }

  if (after) {
    await git.checkout(after);
  }
}

async function processWebhookJob(job) {
  const { repoId, scanId, localPath, branch, after, ref, changedFiles, removedFiles } = job.data;

  if (!repoId || !scanId || !localPath) {
    throw new Error("Webhook job is missing repoId, scanId, or localPath");
  }

  await updateRepository(localPath, { after, ref, branch });

  const partialGraph = await runPartialScan(localPath, changedFiles);
  const parserPatch = patchStoredGraph(repoId, partialGraph, { removedFiles });

  let neo4jPatch = null;
  let neo4jError = null;
  try {
    neo4jPatch = await patchNeo4jGraph(repoId, scanId, partialGraph, {
      removedFiles,
      commitSha: after,
    });
  } catch (error) {
    neo4jError = error;
  }

  broadcast(repoId, {
    type: "GRAPH_PATCH",
    repoId,
    scanId,
    commit: after,
    patch: parserPatch,
    timestamp: new Date().toISOString(),
  });

  broadcast(repoId, {
    type: "SCAN_COMPLETE",
    repoId,
    scanId,
    commit: after,
    summary: parserPatch.summary,
    neo4j: neo4jPatch,
    timestamp: new Date().toISOString(),
  });

  if (neo4jError) {
    broadcast(repoId, {
      type: "SYNC_ERROR",
      repoId,
      scanId,
      error: neo4jError.message,
      scope: "neo4j",
      timestamp: new Date().toISOString(),
    });
  }

  return {
    parserPatch,
    neo4jPatch,
  };
}

async function workerLoop() {
  while (!workerStopped) {
    const job = await takeNextWebhookJob();
    if (!job) {
      await delay(1500);
      continue;
    }

    try {
      const result = await processWebhookJob(job);
      await completeWebhookJob(job, result);
    } catch (error) {
      broadcast(job?.data?.repoId, {
        type: "SYNC_ERROR",
        repoId: job?.data?.repoId || null,
        scanId: job?.data?.scanId || null,
        error: error.message,
        scope: "worker",
        timestamp: new Date().toISOString(),
      });
      await failWebhookJob(job, error);
    }
  }
}

export function startWebhookWorker() {
  if (workerStarted) {
    return;
  }
  workerStarted = true;
  workerStopped = false;
  workerLoop().catch((error) => {
    console.error("Webhook worker crashed:", error);
    workerStarted = false;
  });
}

export function stopWebhookWorker() {
  workerStopped = true;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  startWebhookWorker();
}
