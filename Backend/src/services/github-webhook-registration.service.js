import axios from "axios";
import crypto from "crypto";

function buildGithubHeaders(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function registerWebhookForRepo(repoFullName, accessToken) {
  if (!process.env.APP_PUBLIC_URL) {
    throw new Error("APP_PUBLIC_URL is required to register GitHub webhooks");
  }
  if (!repoFullName) {
    throw new Error("repoFullName is required to register a GitHub webhook");
  }
  if (!accessToken) {
    throw new Error("A GitHub token is required to register a GitHub webhook");
  }

  const secret = crypto.randomBytes(32).toString("hex");
  const hookUrl = `${process.env.APP_PUBLIC_URL.replace(/\/+$/g, "")}/api/webhook/github`;

  const { data } = await axios.post(
    `https://api.github.com/repos/${repoFullName}/hooks`,
    {
      name: "web",
      active: true,
      events: ["push", "delete", "create"],
      config: {
        url: hookUrl,
        content_type: "json",
        secret,
        insecure_ssl: "0",
      },
    },
    { headers: buildGithubHeaders(accessToken) }
  );

  return {
    hookId: data.id,
    secret,
  };
}

export async function deleteWebhookForRepo(repoFullName, hookId, accessToken) {
  if (!repoFullName || !hookId || !accessToken) {
    return;
  }

  await axios.delete(`https://api.github.com/repos/${repoFullName}/hooks/${hookId}`, {
    headers: buildGithubHeaders(accessToken),
  });
}
