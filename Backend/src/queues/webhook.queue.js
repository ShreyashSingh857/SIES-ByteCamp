import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { WEBHOOK_JOBS_ROOT, ensureWorkspaceDirectories } from "../services/scan-workspace.service.js";

const PENDING_DIR = path.join(WEBHOOK_JOBS_ROOT, "pending");
const PROCESSING_DIR = path.join(WEBHOOK_JOBS_ROOT, "processing");
const COMPLETED_DIR = path.join(WEBHOOK_JOBS_ROOT, "completed");
const FAILED_DIR = path.join(WEBHOOK_JOBS_ROOT, "failed");

async function ensureQueueDirectories() {
  ensureWorkspaceDirectories();
  await fs.mkdir(PENDING_DIR, { recursive: true });
  await fs.mkdir(PROCESSING_DIR, { recursive: true });
  await fs.mkdir(COMPLETED_DIR, { recursive: true });
  await fs.mkdir(FAILED_DIR, { recursive: true });
}

function getJobPath(directory, jobId) {
  return path.join(directory, `${jobId}.json`);
}

async function tryReadJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function enqueueWebhookJob(name, data, options = {}) {
  await ensureQueueDirectories();

  const jobId = options.jobId || randomUUID();
  const existing =
    (await tryReadJson(getJobPath(PENDING_DIR, jobId))) ||
    (await tryReadJson(getJobPath(PROCESSING_DIR, jobId))) ||
    (await tryReadJson(getJobPath(COMPLETED_DIR, jobId)));

  if (existing) {
    return { jobId, deduped: true };
  }

  const payload = {
    id: jobId,
    name,
    data,
    attemptsMade: 0,
    maxAttempts: Number(options.attempts) || 3,
    backoffMs: Number(options.backoffMs) || 5000,
    availableAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(getJobPath(PENDING_DIR, jobId), JSON.stringify(payload, null, 2), "utf8");
  return { jobId, deduped: false };
}

export async function takeNextWebhookJob() {
  await ensureQueueDirectories();

  const files = (await fs.readdir(PENDING_DIR)).filter((file) => file.endsWith(".json")).sort();
  const now = Date.now();

  for (const file of files) {
    const pendingPath = path.join(PENDING_DIR, file);
    const job = await tryReadJson(pendingPath);
    if (!job) {
      continue;
    }
    if (new Date(job.availableAt || 0).getTime() > now) {
      continue;
    }

    const processingPath = path.join(PROCESSING_DIR, file);
    try {
      await fs.rename(pendingPath, processingPath);
      return {
        ...job,
        fileName: file,
        filePath: processingPath,
      };
    } catch {
      // Another worker may have claimed it first.
    }
  }

  return null;
}

export async function completeWebhookJob(job, result = {}) {
  if (!job?.fileName || !job?.filePath) {
    return;
  }

  const completedJob = {
    ...job,
    result,
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(path.join(COMPLETED_DIR, job.fileName), JSON.stringify(completedJob, null, 2), "utf8");
  await fs.rm(job.filePath, { force: true });
}

export async function failWebhookJob(job, error) {
  if (!job?.fileName || !job?.filePath) {
    return;
  }

  const attemptsMade = Number(job.attemptsMade || 0) + 1;
  const nextJob = {
    ...job,
    attemptsMade,
    lastError: error?.message || String(error || "Unknown queue error"),
    updatedAt: new Date().toISOString(),
  };

  if (attemptsMade < Number(job.maxAttempts || 3)) {
    const delay = Number(job.backoffMs || 5000) * 2 ** (attemptsMade - 1);
    nextJob.availableAt = new Date(Date.now() + delay).toISOString();
    await fs.writeFile(getJobPath(PENDING_DIR, job.id), JSON.stringify(nextJob, null, 2), "utf8");
  } else {
    nextJob.failedAt = new Date().toISOString();
    await fs.writeFile(path.join(FAILED_DIR, job.fileName), JSON.stringify(nextJob, null, 2), "utf8");
  }

  await fs.rm(job.filePath, { force: true });
}
