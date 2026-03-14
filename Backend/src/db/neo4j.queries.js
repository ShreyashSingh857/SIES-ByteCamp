import { getSession } from '../config/neo4j.js';

// Impact simulation — BFS from a DbField
export async function getImpactGraph(nodeId, scanId) {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH path = (start:DbField {id: $nodeId})-[*1..6]-(affected)
       WHERE affected.scanId = $scanId AND NOT affected:Scan
       RETURN DISTINCT affected.id AS id,
              affected.name AS name,
              labels(affected)[0] AS type,
              length(path) AS hops
       ORDER BY hops ASC LIMIT 200`,
      { nodeId, scanId }
    );
    return result.records.map(r => r.toObject());
  } finally {
    await session.close();
  }
}

// Full graph fetch for UI render
export async function getFullGraph(scanId) {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (n) WHERE n.scanId = $scanId AND NOT n:Scan
       OPTIONAL MATCH (n)-[r]-(m) WHERE m.scanId = $scanId
       RETURN collect(DISTINCT n) AS nodes,
              collect(DISTINCT r) AS edges`,
      { scanId }
    );
    return result.records[0].toObject();
  } finally {
    await session.close();
  }
}

// Bulk delete scan
export async function deleteScan(scanId) {
  const session = getSession();
  try {
    await session.run(
      `MATCH (n) WHERE n.scanId = $scanId DETACH DELETE n`,
      { scanId }
    );
  } finally {
    await session.close();
  }
}

// Find services consuming an endpoint
export async function getEndpointConsumers(endpointId) {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (consumer)-[:CONSUMES_API]->(ep:ApiEndpoint {id: $endpointId})
       RETURN consumer.name, labels(consumer)[0] AS type, consumer.language`,
      { endpointId }
    );
    return result.records.map(r => r.toObject());
  } finally {
    await session.close();
  }
}