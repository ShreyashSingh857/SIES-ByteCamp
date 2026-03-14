import { getSession } from '../config/neo4j.js';

// ==========================================
// SCHEMA SETUP
// ==========================================

export async function setupDatabaseSchema() {
  const session = getSession();
  try {
    // Unique Constraints
    const constraints = [
      'CREATE CONSTRAINT scan_id_unique IF NOT EXISTS FOR (n:Scan) REQUIRE n.id IS UNIQUE',
      'CREATE CONSTRAINT service_id_unique IF NOT EXISTS FOR (n:Service) REQUIRE n.id IS UNIQUE',
      'CREATE CONSTRAINT file_id_unique IF NOT EXISTS FOR (n:File) REQUIRE n.id IS UNIQUE',
      'CREATE CONSTRAINT function_id_unique IF NOT EXISTS FOR (n:Function) REQUIRE n.id IS UNIQUE',
      'CREATE CONSTRAINT endpoint_id_unique IF NOT EXISTS FOR (n:ApiEndpoint) REQUIRE n.id IS UNIQUE',
      'CREATE CONSTRAINT dbtable_id_unique IF NOT EXISTS FOR (n:DbTable) REQUIRE n.id IS UNIQUE',
      'CREATE CONSTRAINT dbfield_id_unique IF NOT EXISTS FOR (n:DbField) REQUIRE n.id IS UNIQUE',
      'CREATE CONSTRAINT contract_id_unique IF NOT EXISTS FOR (n:ApiContract) REQUIRE n.id IS UNIQUE'
    ];

    // scanId Indexes
    const scanIndexes = [
      'CREATE INDEX scan_ref_service IF NOT EXISTS FOR (n:Service) ON (n.scanId)',
      'CREATE INDEX scan_ref_file IF NOT EXISTS FOR (n:File) ON (n.scanId)',
      'CREATE INDEX scan_ref_function IF NOT EXISTS FOR (n:Function) ON (n.scanId)',
      'CREATE INDEX scan_ref_endpoint IF NOT EXISTS FOR (n:ApiEndpoint) ON (n.scanId)',
      'CREATE INDEX scan_ref_dbtable IF NOT EXISTS FOR (n:DbTable) ON (n.scanId)',
      'CREATE INDEX scan_ref_dbfield IF NOT EXISTS FOR (n:DbField) ON (n.scanId)',
      'CREATE INDEX scan_ref_contract IF NOT EXISTS FOR (n:ApiContract) ON (n.scanId)'
    ];

    // Foreign Key Indexes
    const fkIndexes = [
      'CREATE INDEX file_service_idx IF NOT EXISTS FOR (n:File) ON (n.serviceId)',
      'CREATE INDEX function_file_idx IF NOT EXISTS FOR (n:Function) ON (n.fileId)',
      'CREATE INDEX function_service_idx IF NOT EXISTS FOR (n:Function) ON (n.serviceId)',
      'CREATE INDEX endpoint_service_idx IF NOT EXISTS FOR (n:ApiEndpoint) ON (n.serviceId)',
      'CREATE INDEX dbfield_table_idx IF NOT EXISTS FOR (n:DbField) ON (n.tableId)',
      'CREATE INDEX dbtable_service_idx IF NOT EXISTS FOR (n:DbTable) ON (n.serviceId)'
    ];

    // Domain Query Indexes
    const domainIndexes = [
      'CREATE INDEX scan_status_idx IF NOT EXISTS FOR (n:Scan) ON (n.status)',
      'CREATE INDEX scan_user_idx IF NOT EXISTS FOR (n:Scan) ON (n.userId)',
      'CREATE INDEX service_lang_idx IF NOT EXISTS FOR (n:Service) ON (n.language)',
      'CREATE INDEX endpoint_method_idx IF NOT EXISTS FOR (n:ApiEndpoint) ON (n.method)',
      'CREATE INDEX dbtable_name_idx IF NOT EXISTS FOR (n:DbTable) ON (n.tableName)',
      'CREATE INDEX dbfield_name_idx IF NOT EXISTS FOR (n:DbField) ON (n.fieldName)',
      'CREATE INDEX contract_conf_idx IF NOT EXISTS FOR (n:ApiContract) ON (n.confidenceScore)'
    ];

    const allQueries = [...constraints, ...scanIndexes, ...fkIndexes, ...domainIndexes];

    for (const query of allQueries) {
      await session.run(query);
    }
    console.log('✅ Base Neo4j schema (Constraints & Indexes) validated.');
  } catch (error) {
    console.error('❌ Error setting up Neo4j Database Schema:', error);
    throw error;
  } finally {
    await session.close();
  }
}

// ==========================================
// CORE TOPOLOGY / DEMO QUERIES 
// ==========================================

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

// ==========================================
// RELATIONSHIP QUERIES (CODE, HTTP, DB, API)
// ==========================================

export async function getFileRelationships(scanId) {
  const session = getSession();
  try {
    // Retrieves Service->File and File->File(IMPORTS) topology
    const result = await session.run(
      `MATCH (f1:File)-[r:IMPORTS]->(f2:File)
       WHERE f1.scanId = $scanId AND f2.scanId = $scanId
       RETURN f1.path AS ImporterFile, 
              r.importPath AS RawImportString, r.isRelative AS IsRelativeImport, 
              f2.path AS ImportedFile`,
      { scanId }
    );
    return result.records.map(r => r.toObject());
  } finally {
    await session.close();
  }
}

export async function getFunctionCalls(scanId) {
  const session = getSession();
  try {
    // Retrieves Function->Function(CALLS) topology
    const result = await session.run(
      `MATCH (caller:Function)-[r:CALLS]->(callee:Function)
       WHERE caller.scanId = $scanId AND callee.scanId = $scanId
       RETURN caller.name AS CallerFunction, 
              r.callSite AS LineNumber, r.isCrossService AS CrossServiceCall,
              callee.name AS CalleeFunction, callee.serviceId AS CalleeService`,
      { scanId }
    );
    return result.records.map(r => r.toObject());
  } finally {
    await session.close();
  }
}

export async function getExposedEndpoints(scanId) {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (svc:Service)-[r:EXPOSES_API]->(ep:ApiEndpoint)
       WHERE svc.scanId = $scanId
       RETURN svc.name AS ServiceName, svc.framework AS Framework, 
              ep.method AS HttpMethod, ep.path AS EndpointPath, ep.fullPath AS FullUrl`,
      { scanId }
    );
    return result.records.map(r => r.toObject());
  } finally {
    await session.close();
  }
}

export async function getDatabaseTopology(scanId) {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (tbl:DbTable)-[r:HAS_FIELD]->(fld:DbField)
       WHERE tbl.scanId = $scanId
       RETURN tbl.tableName AS Table, tbl.dbType AS DBType, 
              fld.fieldName AS Column, fld.dataType AS DataType, 
              fld.isPrimaryKey AS IsPK, fld.isNullable AS IsNullable`,
      { scanId }
    );
    return result.records.map(r => r.toObject());
  } finally {
    await session.close();
  }
}

export async function getDatabaseAccessors(scanId) {
  const session = getSession();
  try {
    // Matches Services/Functions that use Tables/Fields
    const result = await session.run(
      `MATCH (accessor)-[r:USES_TABLE|USES_FIELD]->(dbObj)
       WHERE accessor.scanId = $scanId
       RETURN labels(accessor)[0] AS AccessorType, accessor.name AS AccessorName, 
              type(r) AS AccessorRole, r.accessType AS QueryType,  
              labels(dbObj)[0] AS DbType, dbObj.name AS DbName`, // assuming db fields/tables will have a name fallback query locally
      { scanId }
    );
    return result.records.map(r => r.toObject());
  } finally {
    await session.close();
  }
}

export async function getApiContracts(scanId) {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (ep:ApiEndpoint)-[r:INFERRED_BY]->(contract:ApiContract)
       WHERE ep.scanId = $scanId
       RETURN ep.method AS Method, ep.path AS EndpointName, 
              contract.inferenceModel AS AIModel, contract.confidenceScore AS Confidence, 
              contract.authType AS AuthRequired`,
      { scanId }
    );
    return result.records.map(r => r.toObject());
  } finally {
    await session.close();
  }
}

// Get all CALLS_API edges for a scan
export async function getApiCalls(scanId) {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (caller)-[:CALLS_API]->(api:API)
       WHERE caller.scanId = $scanId
       RETURN caller.id AS callerId, caller.name AS callerName,
              api.id AS apiId, api.name AS apiName`,
      { scanId }
    );
    return result.records.map(r => r.toObject());
  } finally {
    await session.close();
  }
}

// Get all READS_DB edges for a scan
export async function getDbReads(scanId) {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (reader)-[:READS_DB]->(field:DBField)
       WHERE reader.scanId = $scanId
       RETURN reader.id AS readerId, reader.name AS readerName,
              field.id AS fieldId, field.fieldName AS fieldName`,
      { scanId }
    );
    return result.records.map(r => r.toObject());
  } finally {
    await session.close();
  }
}

// Generic impact query by node identity text (name/fieldName/tableName/path)
export async function getImpactedNodesByNode(node, scanId) {
  const session = getSession();
  try {
    const result = await session.run(
      `MATCH (m)
       WHERE (m.id = $node OR m.name = $node OR m.fieldName = $node OR m.tableName = $node OR m.path = $node)
         AND ($scanId IS NULL OR m.scanId = $scanId)
       WITH DISTINCT m
       MATCH path = (n)-[*1..6]->(m)
       WHERE ($scanId IS NULL OR n.scanId = $scanId)
         AND NOT n:Scan
       RETURN n.id AS id,
              COALESCE(n.name, n.fieldName, n.tableName, n.path, n.id) AS name,
              labels(n)[0] AS type,
              min(length(path)) AS hops
       ORDER BY hops ASC
       LIMIT 200`,
      { node, scanId: scanId || null }
    );
    return result.records.map((r) => r.toObject());
  } finally {
    await session.close();
  }
}

export async function getGraphMetrics(scanId) {
  const session = getSession();
  try {
    const dependencyRelTypes = ["IMPORTS", "CALLS", "CONSUMES_API", "USES_TABLE", "USES_FIELD", "EXPOSES_API"];
    const result = await session.run(
      `CALL {
         WITH $scanId AS scanId
         MATCH (:Service {scanId: scanId})
         RETURN count(*) AS totalServices
       }
       CALL {
         WITH $scanId AS scanId, $dependencyRelTypes AS dependencyRelTypes
         MATCH (a)-[r]->(b)
         WHERE a.scanId = scanId AND b.scanId = scanId AND type(r) IN dependencyRelTypes
         RETURN count(r) AS totalDependencies
       }
       RETURN totalServices, totalDependencies`,
      { scanId, dependencyRelTypes }
    );
    return result.records[0]?.toObject() || { totalServices: 0, totalDependencies: 0 };
  } finally {
    await session.close();
  }
}

export async function seedParsedGraph({ scanNode, serviceNode, files, functions, containsEdges, dependencyEdges }) {
  const session = getSession();
  try {
    await session.executeWrite(async (tx) => {
      await tx.run(
        `MERGE (scan:Scan {id: $scan.id})
         SET scan.status = $scan.status,
             scan.repoUrls = $scan.repoUrls,
             scan.fileCount = $scan.fileCount,
             scan.nodeCount = $scan.nodeCount,
             scan.edgeCount = $scan.edgeCount,
             scan.durationMs = $scan.durationMs,
             scan.userId = $scan.userId,
             scan.createdAt = datetime($scan.createdAt),
             scan.completedAt = datetime($scan.completedAt)
         MERGE (svc:Service {id: $service.id})
         SET svc += $service
         MERGE (scan)-[:CONTAINS]->(svc)`,
        { scan: scanNode, service: serviceNode }
      );

      await tx.run(`UNWIND $files AS f MERGE (node:File {id: f.id}) SET node += f`, { files });
      await tx.run(`UNWIND $functions AS f MERGE (node:Function {id: f.id}) SET node += f`, { functions });
      await tx.run(
        `UNWIND $containsEdges AS e
         MATCH (a {id: e.fromId}), (b {id: e.toId})
         MERGE (a)-[:CONTAINS]->(b)`,
        { containsEdges }
      );
      await tx.run(
        `UNWIND $dependencyEdges AS e
         MATCH (a {id: e.fromId}), (b {id: e.toId})
         FOREACH (_ IN CASE WHEN e.type = 'IMPORTS' THEN [1] ELSE [] END | MERGE (a)-[:IMPORTS]->(b))
         FOREACH (_ IN CASE WHEN e.type = 'CALLS' THEN [1] ELSE [] END | MERGE (a)-[:CALLS]->(b))`,
        { dependencyEdges }
      );
    });
  } finally {
    await session.close();
  }
}