import driver from '../config/neo4j.js';

/**
 * Import AI-Engine generated dependency graph into Neo4j
 * @param {Object} graphData The dependency graph from AI-Engine with LLM insights
 * @param {string} scanId Unique scan identifier
 * @returns {Promise<Object>} Import statistics
 */
export async function importDependencyGraphToNeo4j(graphData, scanId) {
  const session = driver.session();
  
  try {
    // Create Scan node
    await session.run(
      `CREATE (scan:Scan {
        id: $scanId,
        timestamp: datetime(),
        graphGenerated: true,
        llmEnhanced: true,
        model: $model,
        totalNodes: $totalNodes,
        totalEdges: $totalEdges
      })`,
      {
        scanId,
        model: process.env.OPENAI_MODEL || 'Qwen/Qwen3-0.6B',
        totalNodes: graphData.nodes?.length || 0,
        totalEdges: graphData.edges?.length || 0,
      }
    );

    // Create nodes with LLM insights
    if (graphData.nodes && graphData.nodes.length > 0) {
      const nodeChunks = chunkArray(graphData.nodes, 100);
      
      for (const chunk of nodeChunks) {
        const params = { nodes: chunk, scanId };
        
        await session.run(
          `UNWIND $nodes AS nodeData
           MERGE (n:${`\`\${nodeData.type}\``} {id: nodeData.id})
           ON CREATE SET
             n.name = nodeData.name,
             n.filePath = nodeData.filePath,
             n.lineNumber = nodeData.lineNumber,
             n.type = nodeData.type,
             n.scope = nodeData.scope,
             n.llmClassification = nodeData.llmClassification,
             n.llmInsights = nodeData.llmInsights,
             n.createdAt = datetime(),
             n.scanId = $scanId
           MERGE (scan:Scan {id: $scanId})
           MERGE (scan)-[:CONTAINS]->(n)`,
          params
        );
      }
    }

    // Create edges (relationships) with dependency type
    if (graphData.edges && graphData.edges.length > 0) {
      const edgeChunks = chunkArray(graphData.edges, 100);
      
      for (const chunk of edgeChunks) {
        const params = { edges: chunk, scanId };
        
        await session.run(
          `UNWIND $edges AS edgeData
           MATCH (source {id: edgeData.source})
           MATCH (target {id: edgeData.target})
           MERGE (source)-[rel:${'\`\${edgeData.type}\`'} {scanId: $scanId}]->(target)
           ON CREATE SET
             rel.staticDependency = edgeData.staticDependency,
             rel.runtimeDependency = edgeData.runtimeDependency,
             rel.scope = edgeData.scope,
             rel.llmAnalysis = edgeData.llmAnalysis,
             rel.strength = edgeData.strength,
             rel.createdAt = datetime()`,
          params
        );
      }
    }

    // Index nodes for faster querying
    await session.run(
      `CREATE INDEX idx_node_scan IF NOT EXISTS FOR (n) ON (n.scanId)`,
    );

    return {
      success: true,
      scanId,
      nodesImported: graphData.nodes?.length || 0,
      edgesImported: graphData.edges?.length || 0,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Neo4j import error:', error);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Get imported scan by ID with statistics
 */
export async function getScanDetails(scanId) {
  const session = driver.session();
  
  try {
    const result = await session.run(
      `MATCH (scan:Scan {id: $scanId})
       RETURN scan,
              size((scan)-[:CONTAINS]->()) as nodeCount,
              size((scan)-[:CONTAINS]-()--()) as edgeCount`,
      { scanId }
    );

    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    return {
      id: record.get('scan').properties.id,
      timestamp: record.get('scan').properties.timestamp,
      model: record.get('scan').properties.model,
      nodeCount: record.get('nodeCount').low || 0,
      edgeCount: record.get('edgeCount').low || 0,
    };
  } finally {
    await session.close();
  }
}

/**
 * Get all scans
 */
export async function getAllScans() {
  const session = driver.session();
  
  try {
    const result = await session.run(
      `MATCH (scan:Scan)
       RETURN scan
       ORDER BY scan.timestamp DESC
       LIMIT 50`
    );

    return result.records.map(record => ({
      id: record.get('scan').properties.id,
      timestamp: record.get('scan').properties.timestamp,
      model: record.get('scan').properties.model,
      llmEnhanced: record.get('scan').properties.llmEnhanced,
    }));
  } finally {
    await session.close();
  }
}

/**
 * Clean up old scans to manage database size
 */
export async function deleteOldScans(scanId) {
  const session = driver.session();
  
  try {
    const result = await session.run(
      `MATCH (scan:Scan {id: $scanId})
       DETACH DELETE scan`,
      { scanId }
    );

    return {
      nodesDeleted: result.summary.counters.nodesDeleted(),
      relationshipsDeleted: result.summary.counters.relationshipsDeleted(),
    };
  } finally {
    await session.close();
  }
}

/**
 * Utility: chunk array for batch processing
 */
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
