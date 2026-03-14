import crypto from "crypto";
import { enqueueWebhookJob } from "../queues/webhook.queue.js";
import { getWebhookSubscription } from "../db/webhook.queries.js";

function isValidSignature(signature, expected) {
  const signatureBuffer = Buffer.from(String(signature || ""));
  const expectedBuffer = Buffer.from(String(expected || ""));
  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

export const handleGithubWebhook = async (req, res, next) => {
  try {
    const event = req.headers["x-github-event"];
    const deliveryId = req.headers["x-github-delivery"] || crypto.randomUUID();
    const signature = req.headers["x-hub-signature-256"];
    const body = req.body || {};

    if (event === "ping") {
      return res.status(200).json({ ok: true, event: "ping" });
    }

    if (!signature) {
      return res.status(401).json({ ok: false, message: "Missing GitHub signature" });
    }

    const repoFullName = body.repository?.full_name;
    const subscription = await getWebhookSubscription(repoFullName);
    if (!subscription) {
      return res.status(404).json({ ok: false, message: "Unknown repository subscription" });
    }

    const expected = `sha256=${crypto
      .createHmac("sha256", subscription.secret)
      .update(req.rawBody || Buffer.from(JSON.stringify(body)))
      .digest("hex")}`;

    if (!isValidSignature(signature, expected)) {
      return res.status(401).json({ ok: false, message: "Signature mismatch" });
    }

    if (event !== "push") {
      return res.status(200).json({ ok: true, skipped: true, reason: `Ignored ${event} event` });
    }

    if (subscription.branch && body.ref && body.ref !== `refs/heads/${subscription.branch}`) {
      return res.status(200).json({ ok: true, skipped: true, reason: "Push was for a different branch" });
    }

    const changedFiles = body.commits
      ?.flatMap((commit) => [
        ...(commit.added || []),
        ...(commit.modified || []),
      ]) || [];
    const removedFiles = body.commits?.flatMap((commit) => commit.removed || []) || [];

    const { deduped, jobId } = await enqueueWebhookJob(
      "repo-update",
      {
        repoId: subscription.repoId,
        scanId: subscription.scanId,
        repoFullName,
        localPath: subscription.localPath,
        branch: subscription.branch,
        before: body.before,
        after: body.after,
        ref: body.ref,
        changedFiles: [...new Set(changedFiles)],
        removedFiles: [...new Set(removedFiles)],
      },
      {
        jobId: String(deliveryId),
        attempts: 3,
        backoffMs: 5000,
      }
    );

    return res.status(200).json({
      ok: true,
      queued: !deduped,
      deliveryId,
      jobId,
    });
  } catch (error) {
    next(error);
  }
};
