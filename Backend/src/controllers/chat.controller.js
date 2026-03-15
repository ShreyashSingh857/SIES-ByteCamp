import "dotenv/config";
import { randomUUID } from "crypto";
import OpenAI from "openai";
import { getSession } from "../config/neo4j.js";
import {
  createChatSession,
  appendMessage,
  getSessionMessages,
  getUserSessions,
  deleteSession as deleteSessionQuery,
} from "../db/chat.queries.js";
import { readStoredGraph } from "../services/scan-workspace.service.js";
import { extractFilenameFromMessage, resolveFileDependencies } from "../utils/graphResolver.js";
import { buildChatSystemPrompt, buildFullGraphSummary } from "../utils/chatPromptBuilder.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

async function getOwnedSession(sessionId, userId) {
  const session = getSession();
  try {
    const r = await session.run(
      `MATCH (:User {id:$userId})-[:HAS_SESSION]->(c:ChatSession {id:$sessionId}) RETURN c LIMIT 1`,
      { sessionId, userId }
    );
    return r.records[0]?.get("c")?.properties || null;
  } finally {
    await session.close();
  }
}

export async function listSessions(req, res, next) {
  try {
    const data = await getUserSessions(req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (e) {
    return next(e);
  }
}

export async function createSession(req, res, next) {
  try {
    const { scanId = null, repoId = null, title = "New Chat" } = req.body || {};
    const data = await createChatSession({ id: randomUUID(), userId: req.user.id, scanId, repoId, title });
    return res.status(201).json({ success: true, data });
  } catch (e) {
    return next(e);
  }
}

export async function getSessionHistory(req, res, next) {
  try {
    const owned = await getOwnedSession(req.params.sessionId, req.user.id);
    if (!owned) return res.status(403).json({ success: false, message: "Forbidden" });
    const data = await getSessionMessages(req.params.sessionId);
    return res.status(200).json({ success: true, data });
  } catch (e) {
    return next(e);
  }
}

export async function sendMessage(req, res, next) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ success: false, message: "OPENAI_API_KEY not configured" });
    }

    const { sessionId } = req.params;
    const { content, repoId: bodyRepoId, scanId: bodyScanId } = req.body || {};

    if (!String(content || "").trim()) {
      return res.status(400).json({ success: false, message: "content is required" });
    }

    const owned = await getOwnedSession(sessionId, req.user.id);
    if (!owned) return res.status(403).json({ success: false, message: "Forbidden" });

    const userMessage = await appendMessage({
      id: randomUUID(),
      sessionId,
      userId: req.user.id,
      role: "user",
      content: String(content),
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      tokenCount: Math.ceil(String(content).length / 4),
    });

    const repoId = bodyRepoId || owned.repoId || null;
    const scanId = bodyScanId || owned.scanId || null;

    const storedGraph = repoId ? readStoredGraph(repoId) : null;
    const graphSummary = buildFullGraphSummary(storedGraph);

    const detectedFile = extractFilenameFromMessage(String(content));
    let fileContext = null;

    if (detectedFile && (scanId || repoId)) {
      try {
        fileContext = await resolveFileDependencies({ filePath: detectedFile, scanId, repoId });
      } catch (err) {
        console.warn("[chat.controller] Dependency resolution failed:", err.message);
      }
    }

    const systemPrompt = buildChatSystemPrompt({
      graphSummary,
      fileContext,
      targetFile: detectedFile,
      repoId,
    });

    const history = await getSessionMessages(sessionId);
    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      messages,
      max_tokens: 2000,
      stream: false,
    });

    const assistantText = completion.choices?.[0]?.message?.content?.trim() || "I could not generate a response.";
    const assistantMessage = await appendMessage({
      id: randomUUID(),
      sessionId,
      userId: req.user.id,
      role: "assistant",
      content: assistantText,
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      tokenCount: completion.usage?.completion_tokens || Math.ceil(assistantText.length / 4),
    });

    return res.status(200).json({
      success: true,
      data: {
        userMessage,
        assistantMessage,
        meta: {
          detectedFile: detectedFile || null,
          fileContextFound: !!fileContext,
          fileContextSource: fileContext?.source || null,
          graphNodes: graphSummary?.nodes || 0,
          graphEdges: graphSummary?.edges || 0,
        },
      },
    });
  } catch (e) {
    return next(e);
  }
}

export async function resolveFileContext(req, res, next) {
  try {
    const { sessionId } = req.params;
    const { filePath, repoId: bodyRepoId, scanId: bodyScanId } = req.body || {};

    if (!filePath) {
      return res.status(400).json({ success: false, message: "filePath is required" });
    }

    const owned = await getOwnedSession(sessionId, req.user.id);
    if (!owned) return res.status(403).json({ success: false, message: "Forbidden" });

    const repoId = bodyRepoId || owned.repoId || null;
    const scanId = bodyScanId || owned.scanId || null;
    const fileContext = await resolveFileDependencies({ filePath, scanId, repoId });

    if (!fileContext) {
      return res.status(404).json({ success: false, message: `File "${filePath}" not found in graph` });
    }

    return res.status(200).json({ success: true, data: fileContext });
  } catch (e) {
    return next(e);
  }
}

export async function deleteSession(req, res, next) {
  try {
    await deleteSessionQuery(req.params.sessionId, req.user.id);
    return res.status(200).json({ success: true, message: "Session deleted" });
  } catch (e) {
    return next(e);
  }
}
