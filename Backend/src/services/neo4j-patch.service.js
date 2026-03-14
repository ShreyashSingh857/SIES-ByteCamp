import { getSession } from "../config/neo4j.js";
import { buildSeedPayloadFromParser } from "./scan-workspace.service.js";

function getRemovedFileIds(scanId, removedFiles = []) {
  return (removedFiles || []).filter(Boolean).map((filePath) => `file:${scanId}:file:${filePath}`);
}

export async function patchNeo4jGraph(repoId, scanId, partialGraph, { removedFiles = [], commitSha = null } = {}) {
  const session = getSession();
  const payload = buildSeedPayloadFromParser(repoId, partialGraph, scanId);
  const syncTimestamp = new Date().toISOString();
  const serviceProps = {
    ...payload.serviceNode,
    updatedAt: syncTimestamp,
  };
  delete serviceProps.fileCount;

  const changedFileIds = payload.files.map((file) => file.id);
  const currentFunctionIds = payload.functions.map((fn) => fn.id);
  const removedFileIds = getRemovedFileIds(scanId, removedFiles);

  try {
    await session.executeWrite(async (tx) => {
      await tx.run(
        `MERGE (scan:Scan {id: $scanId})
         ON CREATE SET scan.repoUrls = $repoUrls,
                       scan.fileCount = $fileCount,
                       scan.nodeCount = $nodeCount,
                       scan.edgeCount = $edgeCount,
                       scan.durationMs = $durationMs,
                       scan.userId = $userId,
                       scan.createdAt = datetime($createdAt),
                       scan.completedAt = datetime($completedAt)
         SET scan.status = $status,
             scan.lastWebhookSync = datetime($lastWebhookSync),
             scan.commitSha = $commitSha`,
        {
          scanId,
          ...payload.scanNode,
          lastWebhookSync: syncTimestamp,
          commitSha: commitSha || null,
        }
      );

      await tx.run(
        `MERGE (svc:Service {id: $service.id})
         SET svc += $service
         WITH svc
         MATCH (scan:Scan {id: $scanId})
         MERGE (scan)-[:CONTAINS]->(svc)`,
        {
          service: serviceProps,
          scanId,
        }
      );

      if (removedFileIds.length > 0) {
        await tx.run(
          `UNWIND $removedFileIds AS fileId
           OPTIONAL MATCH (fn:Function {fileId: fileId, scanId: $scanId})
           DETACH DELETE fn`,
          { removedFileIds, scanId }
        );
        await tx.run(
          `UNWIND $removedFileIds AS fileId
           OPTIONAL MATCH (file:File {id: fileId, scanId: $scanId})
           DETACH DELETE file`,
          { removedFileIds, scanId }
        );
      }

      if (payload.files.length > 0) {
        await tx.run(`UNWIND $files AS f MERGE (node:File {id: f.id}) SET node += f`, {
          files: payload.files,
        });
      }

      if (payload.functions.length > 0) {
        await tx.run(`UNWIND $functions AS f MERGE (node:Function {id: f.id}) SET node += f`, {
          functions: payload.functions,
        });
      }

      if (changedFileIds.length > 0) {
        await tx.run(
          `UNWIND $changedFileIds AS fileId
           MATCH (fn:Function {fileId: fileId, scanId: $scanId})
           WHERE NOT fn.id IN $currentFunctionIds
           DETACH DELETE fn`,
          { changedFileIds, currentFunctionIds, scanId }
        );

        await tx.run(
          `MATCH (file:File {scanId: $scanId})-[r:IMPORTS]->()
           WHERE file.id IN $changedFileIds
           DELETE r`,
          { changedFileIds, scanId }
        );

        await tx.run(
          `MATCH (fn:Function {scanId: $scanId})-[r:CALLS]->()
           WHERE fn.fileId IN $changedFileIds
           DELETE r`,
          { changedFileIds, scanId }
        );

        await tx.run(
          `MATCH (file:File {scanId: $scanId})-[r:CONTAINS]->(fn:Function)
           WHERE file.id IN $changedFileIds
           DELETE r`,
          { changedFileIds, scanId }
        );
      }

      if (payload.containsEdges.length > 0) {
        await tx.run(
          `UNWIND $containsEdges AS e
           MATCH (a {id: e.fromId}), (b {id: e.toId})
           MERGE (a)-[:CONTAINS]->(b)`,
          { containsEdges: payload.containsEdges }
        );
      }

      if (payload.dependencyEdges.length > 0) {
        await tx.run(
          `UNWIND $dependencyEdges AS e
           MATCH (a {id: e.fromId}), (b {id: e.toId})
           FOREACH (_ IN CASE WHEN e.type = 'IMPORTS' THEN [1] ELSE [] END | MERGE (a)-[:IMPORTS]->(b))
           FOREACH (_ IN CASE WHEN e.type = 'CALLS' THEN [1] ELSE [] END | MERGE (a)-[:CALLS]->(b))`,
          { dependencyEdges: payload.dependencyEdges }
        );
      }
    });

    return {
      filesPatched: payload.files.length,
      functionsPatched: payload.functions.length,
      dependencyEdgesPatched: payload.dependencyEdges.length,
      removedFiles: removedFiles.length,
    };
  } finally {
    await session.close();
  }
}
