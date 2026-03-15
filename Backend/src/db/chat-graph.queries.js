import { getSession } from "../config/neo4j.js";

export async function getForwardDependencies(filePath, scanId) {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (f:File {scanId: $scanId})-[:IMPORTS]->(dep:File {scanId: $scanId})
       WHERE f.path CONTAINS $filePath OR f.path ENDS WITH $filePath
       RETURN dep.path AS path, dep.language AS language, dep.id AS id
       LIMIT 50`,
      { scanId, filePath }
    );
    return result.records.map((r) => r.toObject());
  } finally {
    await session.close();
  }
}

export async function getReverseDependencies(filePath, scanId) {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (importer:File {scanId: $scanId})-[:IMPORTS]->(f:File {scanId: $scanId})
       WHERE f.path CONTAINS $filePath OR f.path ENDS WITH $filePath
       RETURN importer.path AS path, importer.language AS language, importer.id AS id
       LIMIT 50`,
      { scanId, filePath }
    );
    return result.records.map((r) => r.toObject());
  } finally {
    await session.close();
  }
}

export async function getFunctionsInFile(filePath, scanId) {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (f:File {scanId: $scanId})<-[:DEFINED_IN|CONTAINS]-(fn:Function {scanId: $scanId})
       WHERE f.path CONTAINS $filePath OR f.path ENDS WITH $filePath
       RETURN fn.name AS name, fn.qualifiedName AS qualifiedName, fn.lineStart AS lineStart
       LIMIT 30`,
      { scanId, filePath }
    );
    return result.records.map((r) => r.toObject());
  } finally {
    await session.close();
  }
}

export async function getTransitiveDependencies(filePath, scanId, direction = "BOTH", maxDepth = 4) {
  const session = getSession();
  try {
    const relPattern = direction === "FORWARD" ? "-[:IMPORTS]->" : direction === "REVERSE" ? "<-[:IMPORTS]-" : "-[:IMPORTS]-";
    const result = await session.run(
      `MATCH path = (start:File {scanId: $scanId})${relPattern}(related:File {scanId: $scanId})
       WHERE (start.path CONTAINS $filePath OR start.path ENDS WITH $filePath)
         AND length(path) <= $maxDepth
       RETURN DISTINCT related.path AS path, related.language AS language, length(path) AS depth
       ORDER BY depth ASC LIMIT 80`,
      { scanId, filePath, maxDepth }
    );
    return result.records.map((r) => r.toObject());
  } finally {
    await session.close();
  }
}

export async function findFileNodeByName(filePath, scanId) {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (f:File {scanId: $scanId})
       WHERE f.path CONTAINS $filePath OR f.path ENDS WITH $filePath
       RETURN f.path AS path, f.language AS language, f.id AS id, f.lineCount AS lineCount
       LIMIT 5`,
      { scanId, filePath }
    );
    return result.records.map((r) => r.toObject());
  } finally {
    await session.close();
  }
}

export async function executeReadOnlyCypher(cypher, params = {}) {
  const forbidden = /\b(CREATE|MERGE|SET|DELETE|REMOVE|DROP|CALL\s+db\.)/i;
  if (forbidden.test(cypher)) {
    throw new Error("Write operations are not permitted via chat interface.");
  }
  const session = getSession();
  try {
    const result = await session.run(cypher, params);
    return result.records.map((r) => r.toObject());
  } finally {
    await session.close();
  }
}
