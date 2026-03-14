import fs from "fs/promises";
import path from "path";
import { WEBHOOKS_ROOT, ensureWorkspaceDirectories } from "../services/scan-workspace.service.js";

const SUBSCRIPTIONS_FILE = path.join(WEBHOOKS_ROOT, "subscriptions.json");

async function readSubscriptions() {
  ensureWorkspaceDirectories();
  try {
    const raw = await fs.readFile(SUBSCRIPTIONS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    if (error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function writeSubscriptions(subscriptions) {
  ensureWorkspaceDirectories();
  await fs.mkdir(WEBHOOKS_ROOT, { recursive: true });
  await fs.writeFile(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions, null, 2), "utf8");
}

export async function saveWebhookSubscription(subscription) {
  const subscriptions = await readSubscriptions();
  const repoFullName = String(subscription?.repoFullName || "").trim();
  if (!repoFullName) {
    throw new Error("repoFullName is required to save a webhook subscription");
  }

  subscriptions[repoFullName] = {
    ...(subscriptions[repoFullName] || {}),
    ...subscription,
    updatedAt: new Date().toISOString(),
  };

  await writeSubscriptions(subscriptions);
  return subscriptions[repoFullName];
}

export async function getWebhookSubscription(repoFullName) {
  if (!repoFullName) {
    return null;
  }

  const subscriptions = await readSubscriptions();
  return subscriptions[repoFullName] || null;
}

export async function deleteWebhookSubscription(repoFullName) {
  if (!repoFullName) {
    return false;
  }

  const subscriptions = await readSubscriptions();
  if (!subscriptions[repoFullName]) {
    return false;
  }

  delete subscriptions[repoFullName];
  await writeSubscriptions(subscriptions);
  return true;
}
