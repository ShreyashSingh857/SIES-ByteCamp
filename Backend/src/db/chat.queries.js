import { getSession } from "../config/neo4j.js";

export async function createChatSession({ id, userId, scanId = null, repoId = null, title = "New Chat" }) {
  const s = getSession();
  try {
    const r = await s.run(
      `MERGE (u:User {id:$userId})
       CREATE (c:ChatSession {
         id:$id,userId:$userId,scanId:$scanId,repoId:$repoId,title:$title,
         messageCount:0,createdAt:datetime(),updatedAt:datetime()
       })
       MERGE (u)-[:HAS_SESSION]->(c)
       OPTIONAL MATCH (scan:Scan {id:$scanId})
       FOREACH (_ IN CASE WHEN scan IS NOT NULL THEN [1] ELSE [] END | MERGE (c)-[:ABOUT_SCAN]->(scan))
       RETURN c`,
      { id, userId, scanId, repoId, title }
    );
    return r.records[0]?.get("c")?.properties || null;
  } finally {
    await s.close();
  }
}

export async function appendMessage({ id, sessionId, userId, role, content, model, tokenCount = 0, toolCalls = null }) {
  const s = getSession();
  try {
    const r = await s.run(
      `MATCH (c:ChatSession {id:$sessionId})
       CREATE (m:ChatMessage {
         id:$id,sessionId:$sessionId,userId:$userId,role:$role,content:$content,
         model:$model,tokenCount:$tokenCount,toolCalls:$toolCalls,createdAt:datetime()
       })
       MERGE (c)-[:HAS_MESSAGE]->(m)
       SET c.updatedAt = datetime(), c.messageCount = coalesce(c.messageCount,0) + 1
       RETURN m`,
      { id, sessionId, userId, role, content, model, tokenCount, toolCalls }
    );
    return r.records[0]?.get("m")?.properties || null;
  } finally {
    await s.close();
  }
}

export async function getSessionMessages(sessionId) {
  const s = getSession();
  try {
    const r = await s.run(
      `MATCH (c:ChatSession {id:$sessionId})-[:HAS_MESSAGE]->(m:ChatMessage)
       RETURN m ORDER BY m.createdAt ASC`,
      { sessionId }
    );
    return r.records.map((x) => x.get("m").properties);
  } finally {
    await s.close();
  }
}

export async function getUserSessions(userId) {
  const s = getSession();
  try {
    const r = await s.run(
      `MATCH (:User {id:$userId})-[:HAS_SESSION]->(c:ChatSession)
       RETURN c ORDER BY c.updatedAt DESC`,
      { userId }
    );
    return r.records.map((x) => x.get("c").properties);
  } finally {
    await s.close();
  }
}

export async function deleteSession(sessionId, userId) {
  const s = getSession();
  try {
    await s.run(
      `MATCH (:User {id:$userId})-[:HAS_SESSION]->(c:ChatSession {id:$sessionId})
       OPTIONAL MATCH (c)-[:HAS_MESSAGE]->(m:ChatMessage)
       DETACH DELETE m, c`,
      { sessionId, userId }
    );
    return true;
  } finally {
    await s.close();
  }
}
