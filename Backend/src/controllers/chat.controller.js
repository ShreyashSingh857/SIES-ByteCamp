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

function buildGraphSummary(repoId) {
  const graph = repoId ? readStoredGraph(repoId) : null;
  if (!graph) return "No graph context available.";
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const top = nodes
    .filter((n) => n?.type === "FILE")
    .slice(0, 8)
    .map((n) => n.name)
    .filter(Boolean)
    .join(", ");
  return `Graph summary: nodes=${nodes.length}, edges=${edges.length}, topFiles=[${top || "none"}]`;
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
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ success: false, message: "OPENAI_API_KEY not configured" });
    const { sessionId } = req.params;
    const { content, repoId: bodyRepoId } = req.body || {};
    if (!String(content || "").trim()) return res.status(400).json({ success: false, message: "content is required" });

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

    const history = await getSessionMessages(sessionId);
    const repoId = bodyRepoId || owned.repoId || null;
    const systemPrompt = buildGraphSummary(repoId);
    const messages = [
      { role: "system", content: `You are a code assistant for this repository. ${systemPrompt}` },
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

    return res.status(200).json({ success: true, data: { userMessage, assistantMessage } });
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
