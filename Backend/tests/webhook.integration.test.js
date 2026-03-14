import http from "http";
import path from "path";
import crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import axios from "axios";
import { execFile } from "child_process";
import { promisify } from "util";
import { describe, test, expect, beforeAll, afterAll, jest } from "@jest/globals";
import app from "../app.js";
import { saveWebhookSubscription, deleteWebhookSubscription } from "../src/db/webhook.queries.js";
import { stopWebhookWorker } from "../src/workers/webhook.worker.js";

const execFileAsync = promisify(execFile);

jest.setTimeout?.(90000);

const WEBHOOK_SECRET = "integration-test-secret";
const REPO_FULL_NAME = "local/test-webhook-repo";

let server;
let apiBaseUrl;
let repoPath;
let repoId;
let scanId;
let initialCommitSha;
let updatedCommitSha;

async function runGit(args, cwd) {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

async function waitFor(fn, { timeoutMs = 20000, intervalMs = 500 } = {}) {
  const started = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await fn();
    if (result) {
      return result;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Timed out after ${timeoutMs}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

function createSseCollector(url) {
  let req;
  let resRef;
  let finished = false;
  const messages = [];

  const done = new Promise((resolve, reject) => {
    req = http.get(url, (res) => {
      resRef = res;
      let buffer = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        buffer += chunk;
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const dataLine = part
            .split("\n")
            .find((line) => line.startsWith("data: "));
          if (!dataLine) {
            continue;
          }
          const payload = JSON.parse(dataLine.slice(6));
          messages.push(payload);
          if (
            messages.some((message) => message.type === "GRAPH_PATCH") &&
            messages.some((message) => message.type === "SCAN_COMPLETE")
          ) {
            finished = true;
            resolve(messages);
          }
        }
      });
      res.on("error", reject);
      res.on("close", () => {
        if (!finished) {
          reject(new Error("SSE stream closed before expected messages arrived"));
        }
      });
    });
    req.on("error", reject);
  });

  return {
    done,
    close: () => {
      finished = true;
      req?.destroy();
      resRef?.destroy();
    },
  };
}

describe("Webhook end-to-end integration", () => {
  beforeAll(async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bytecamp-webhook-"));
    repoPath = path.join(tempRoot, "origin-repo");
    await fs.mkdir(path.join(repoPath, "src"), { recursive: true });

    await runGit(["init", "-b", "main"], repoPath);
    await runGit(["config", "user.name", "Codex Test"], repoPath);
    await runGit(["config", "user.email", "codex@example.com"], repoPath);

    await fs.writeFile(
      path.join(repoPath, "src", "index.js"),
      [
        "export function greet(name) {",
        "  return `hello ${name}`;",
        "}",
        "",
      ].join("\n"),
      "utf8"
    );

    await runGit(["add", "."], repoPath);
    await runGit(["commit", "-m", "initial commit"], repoPath);
    initialCommitSha = await runGit(["rev-parse", "HEAD"], repoPath);

    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    apiBaseUrl = `http://127.0.0.1:${port}/api`;
  });

  afterAll(async () => {
    await deleteWebhookSubscription(REPO_FULL_NAME).catch(() => {});
    stopWebhookWorker();
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  test("scan, signed webhook delivery, SSE, and graph refresh all work together", async () => {
    const scanResponse = await axios.post(`${apiBaseUrl}/scan`, {
      repoUrl: repoPath,
      branch: "main",
    });

    expect(scanResponse.status).toBe(200);
    repoId = scanResponse.data.data.repoId;
    scanId = scanResponse.data.data.scanId;
    expect(repoId).toBeTruthy();
    expect(scanId).toBeTruthy();

    const initialGraphResponse = await axios.get(`${apiBaseUrl}/graph/${repoId}`);
    expect(initialGraphResponse.status).toBe(200);
    expect(initialGraphResponse.data.data.nodes.some((node) => node.name === "greet")).toBe(true);

    await saveWebhookSubscription({
      repoId,
      scanId,
      repoFullName: REPO_FULL_NAME,
      repoUrl: repoPath,
      branch: "main",
      localPath: scanResponse.data.data.clonedRepoPath,
      secret: WEBHOOK_SECRET,
      hookId: 1,
    });

    const sse = createSseCollector(`${apiBaseUrl}/events/${repoId}`);

    await fs.writeFile(
      path.join(repoPath, "src", "index.js"),
      [
        "export function greet(name) {",
        "  return `hello ${name}`;",
        "}",
        "",
        "export function farewell(name) {",
        "  return `bye ${name}`;",
        "}",
        "",
      ].join("\n"),
      "utf8"
    );

    await runGit(["add", "."], repoPath);
    await runGit(["commit", "-m", "add farewell"], repoPath);
    updatedCommitSha = await runGit(["rev-parse", "HEAD"], repoPath);

    const webhookPayload = {
      ref: "refs/heads/main",
      before: initialCommitSha,
      after: updatedCommitSha,
      repository: {
        full_name: REPO_FULL_NAME,
      },
      commits: [
        {
          id: updatedCommitSha,
          added: [],
          modified: ["src/index.js"],
          removed: [],
        },
      ],
    };
    const rawBody = JSON.stringify(webhookPayload);
    const signature = `sha256=${crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex")}`;

    const webhookResponse = await axios.post(`${apiBaseUrl}/webhook/github`, rawBody, {
      headers: {
        "Content-Type": "application/json",
        "X-GitHub-Event": "push",
        "X-GitHub-Delivery": `delivery-${Date.now()}`,
        "X-Hub-Signature-256": signature,
      },
    });

    expect(webhookResponse.status).toBe(200);
    expect(webhookResponse.data.ok).toBe(true);
    expect(webhookResponse.data.queued).toBe(true);

    const sseMessages = await sse.done;
    sse.close();

    expect(sseMessages.some((message) => message.type === "GRAPH_PATCH")).toBe(true);
    expect(sseMessages.some((message) => message.type === "SCAN_COMPLETE")).toBe(true);

    const updatedGraphResponse = await waitFor(async () => {
      const response = await axios.get(`${apiBaseUrl}/graph/${repoId}`);
      return response.data.data.nodes.some((node) => node.name === "farewell") ? response : null;
    });

    expect(updatedGraphResponse.status).toBe(200);
    expect(updatedGraphResponse.data.data.nodes.some((node) => node.name === "farewell")).toBe(true);
  });

  test("invalid webhook signature is rejected", async () => {
    expect(repoId).toBeTruthy();

    const response = await axios.post(
      `${apiBaseUrl}/webhook/github`,
      JSON.stringify({
        ref: "refs/heads/main",
        before: initialCommitSha,
        after: updatedCommitSha,
        repository: { full_name: REPO_FULL_NAME },
        commits: [],
      }),
      {
        validateStatus: () => true,
        headers: {
          "Content-Type": "application/json",
          "X-GitHub-Event": "push",
          "X-Hub-Signature-256": "sha256=invalid",
        },
      }
    );

    expect(response.status).toBe(401);
  });
});
