# API Structure Documentation

**Version**: 1.0.0  
**Last Updated**: March 14, 2026  
**Base URL**: `http://localhost:5000/api`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Health & Status](#health--status)
4. [Repository Scanning](#repository-scanning)
5. [Graph Operations](#graph-operations)
6. [Database Operations](#database-operations)
7. [Metrics & Analytics](#metrics--analytics)
8. [Impact Analysis](#impact-analysis)
9. [Error Handling](#error-handling)
10. [Response Formats](#response-formats)

---

## Overview

The SIES-ByteCamp API provides endpoints for:
- Repository scanning and analysis
- Dependency graph visualization
- Neo4j database seeding
- Impact analysis and metrics
- Code structure intelligence

### Key Features
✅ Repository cloning and parsing  
✅ Dependency graph extraction  
✅ Neo4j graph database integration  
✅ Impact traversal analysis  
✅ Metrics and analytics  

---

## Authentication

Currently, the API is **public** (no authentication required).

Future implementation will support:
- JWT Bearer tokens
- Cookie-based sessions
- OAuth2 integration

---

## Health & Status

### GET `/api/health`

**Description**: Check backend health status

**Method**: `GET`

**Parameters**: None

**Response** (200 OK):
```json
{
  "success": true,
  "status": "healthy",
  "uptime": 123.456,
  "timestamp": "2026-03-14T10:30:00.000Z"
}
```

**Errors**: None (always returns 200)

---

### GET `/api`

**Description**: Root health check

**Method**: `GET`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "SIES-ByteCamp API is running 🚀"
}
```

---

## Repository Scanning

### POST `/api/scan`

**Description**: Clone public repository and parse code structure

**Method**: `POST`

**Request Body**:
```json
{
  "repoUrl": "https://github.com/user/repo.git"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Repository cloned and parsed successfully",
  "data": {
    "repoId": "repo-1234567890-abc123",
    "repoUrl": "https://github.com/user/repo.git",
    "workspaceDir": "/path/to/workspace",
    "repositoriesDir": "/path/to/workspace/repositories",
    "clonedRepoPath": "/path/to/repo",
    "graphPath": "/path/to/graph.json",
    "graphApi": "/api/graph/repo-1234567890-abc123",
    "parserSummary": {
      "totalFiles": 150,
      "languages": ["JavaScript", "TypeScript"],
      "totalLines": 50000
    }
  }
}
```

**Errors**:
- `400 Bad Request`: Missing or invalid repoUrl
- `422 Unprocessable Entity`: Failed to clone/parse repository
- `504 Gateway Timeout`: Repository too large or network issues

**Notes**:
- Supports public HTTP(S) URLs
- Supports absolute local paths
- Large repositories may take several minutes
- Maximum repository size: 500MB (configurable)

---

## Graph Operations

### GET `/api/graph/:repoId`

**Description**: Retrieve parsed dependency graph

**Method**: `GET`

**Parameters**:
- `repoId` (path): Repository ID from scan endpoint

**Response** (200 OK):
```json
{
  "success": true,
  "repoId": "repo-1234567890-abc123",
  "data": {
    "nodes": [
      {
        "id": "file:repo-1234567890-abc123:src/index.js",
        "name": "src/index.js",
        "type": "FILE",
        "language": "javascript",
        "lineCount": 250
      },
      {
        "id": "fn:repo-1234567890-abc123:fn001",
        "name": "parseFile",
        "type": "FUNCTION",
        "fileId": "file:repo-1234567890-abc123:src/index.js"
      }
    ],
    "edges": [
      {
        "from": "fn:repo-1234567890-abc123:fn001",
        "to": "fn:repo-1234567890-abc123:fn002",
        "type": "CALLS"
      },
      {
        "from": "file:repo-1234567890-abc123:src/index.js",
        "to": "file:repo-1234567890-abc123:src/utils.js",
        "type": "IMPORTS"
      }
    ],
    "summary": {
      "totalNodes": 250,
      "totalEdges": 1200,
      "fileCount": 150,
      "functionCount": 800,
      "languages": ["javascript", "typescript"]
    }
  }
}
```

**Errors**:
- `404 Not Found`: Repository graph not found
- `500 Internal Server Error`: File system error

---

### DELETE `/api/graph/:repoId`

**Description**: Delete stored parser graph

**Method**: `DELETE`

**Parameters**:
- `repoId` (path): Repository ID

**Response** (200 OK):
```json
{
  "success": true,
  "repoId": "repo-1234567890-abc123",
  "message": "Graph deleted successfully"
}
```

**Errors**:
- `404 Not Found`: Graph not found
- `500 Internal Server Error`: File system error

**Notes**:
- Irreversible operation
- Only deletes stored JSON graph file
- Does NOT delete cloned repository

---

## Database Operations

### POST `/api/db/seed/schema`

**Description**: Initialize Neo4j database schema (constraints and indexes)

**Method**: `POST`

**Parameters**: None

**Request Body**: Empty

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Schema seed completed"
}
```

**Errors**:
- `503 Service Unavailable`: Neo4j not configured or unreachable
- `500 Internal Server Error`: Database error

**Notes**:
- Idempotent operation (safe to call multiple times)
- Creates:
  - Unique constraints on node IDs
  - Indexes on scanId references
  - Indexes on foreign keys
  - Domain query indexes
- Should be called once during initialization

---

### POST `/api/db/seed/graph/:repoId`

**Description**: Seed parsed graph into Neo4j database

**Method**: `POST`

**Parameters**:
- `repoId` (path): Repository ID from scan endpoint

**Request Body** (optional):
```json
{
  "scanId": "scan-custom-001",
  "repoUrl": "https://github.com/user/repo.git"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Graph seeded into Neo4j",
  "data": {
    "repoId": "repo-1234567890-abc123",
    "scanId": "scan-custom-001",
    "fileCount": 150,
    "functionCount": 850,
    "dependencyCount": 1200
  }
}
```

**Errors**:
- `404 Not Found`: Repository graph not found
- `503 Service Unavailable`: Neo4j not configured or unreachable
- `500 Internal Server Error`: Database error

**Notes**:
- Requires graph to be stored (from `/api/scan`)
- Auto-generates scanId if not provided
- Creates nodes: `Scan`, `Service`, `File`, `Function`
- Creates relationships: `CONTAINS`, `IMPORTS`, `CALLS`
- Uses write transactions for consistency

---

## Metrics & Analytics

### GET `/api/metrics/:scanId`

**Description**: Get graph metrics for a scan

**Method**: `GET`

**Parameters**:
- `scanId` (path): Scan ID from graph seeding

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "scanId": "scan-custom-001",
    "totalServices": 5,
    "totalDependencies": 42
  }
}
```

**Errors**:
- `400 Bad Request`: Missing scanId parameter
- `503 Service Unavailable`: Neo4j unavailable
- `404 Not Found`: Scan not found in database

**Notes**:
- Returns aggregated metrics for dashboard display
- `totalServices`: Count of Service nodes
- `totalDependencies`: Count of dependency relationships
- Numbers are normalized from Neo4j integers

---

## Impact Analysis

### GET `/api/impact`

**Description**: Analyze impact of changing a node (BFS traversal)

**Method**: `GET`

**Query Parameters**:
- `node` (required): Node ID to analyze (e.g., `field:scan:fieldId`)
- `scanId` (optional): Scan ID for filtering

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "node": "field:scan-001:fieldId",
    "scanId": "scan-custom-001",
    "count": 25,
    "impactedNodes": [
      {
        "id": "file:scan-001:src/index.js",
        "name": "src/index.js",
        "type": "FILE",
        "hops": 1
      },
      {
        "id": "fn:scan-001:fn102",
        "name": "processData",
        "type": "FUNCTION",
        "hops": 2
      },
      {
        "id": "field:scan-001:outputField",
        "name": "outputField",
        "type": "DbField",
        "hops": 3
      }
    ]
  }
}
```

**Errors**:
- `400 Bad Request`: Missing node parameter
- `503 Service Unavailable`: Neo4j unavailable
- `500 Internal Server Error`: Neo4j error during traversal

**Notes**:
- Performs bounded BFS (1..6 hops)
- Traverses all relationship types
- Returns max 200 results
- `hops`: Distance from source node (guaranteed to be normalized integer)
- Used for impact panels and knowledge graphs

---

## Response Formats

### Standard Success Response

```json
{
  "success": true,
  "message": "Operation completed",
  "data": {
    /* endpoint-specific data */
  }
}
```

### Standard Error Response

```json
{
  "success": false,
  "message": "Error description"
}
```

### Status Codes

| Code | Meaning | Common Use |
|------|---------|-----------|
| 200 | OK | Successful operation |
| 400 | Bad Request | Invalid parameters |
| 404 | Not Found | Resource doesn't exist |
| 422 | Unprocessable Entity | Validation failure |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Neo4j unreachable |
| 504 | Gateway Timeout | Long-running operation |

---

## Node Types

- `FILE`: Source code file
- `FUNCTION`: Function/method
- `Service`: Repository/module
- `Scan`: Analysis scan record
- `ApiEndpoint`: API endpoint definition
- `DbTable`: Database table
- `DbField`: Database field
- `ApiContract`: API contract

---

## Relationship Types

- `CONTAINS`: Parent contains child (Scan→Service, Service→File, File→Function)
- `IMPORTS`: File imports another file
- `CALLS`: Function calls another function
- `DEPENDS_ON`: Generic dependency
- `USES`: Function uses DbField
- `RETURNS`: Function returns DbTable

---

## Configuration

Environment variables (`.env` file):

```env
# Server
PORT=5000
NODE_ENV=production
CLIENT_URL=http://localhost:5173

# Neo4j
NEO4J_URI=neo4j://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
```

---

## Integration Examples

### Complete Workflow

```javascript
// 1. Scan repository
POST /api/scan
→ Get repoId

// 2. Retrieve graph
GET /api/graph/:repoId
→ Get nodes and edges for visualization

// 3. Initialize database (once)
POST /api/db/seed/schema

// 4. Seed graph to database
POST /api/db/seed/graph/:repoId
→ Get scanId

// 5. Get metrics
GET /api/metrics/:scanId
→ Display on dashboard

// 6. Analyze impact
GET /api/impact?node=<nodeId>&scanId=<scanId>
→ Show affected nodes
```

---

## Changelog

### v1.0.0 (2026-03-14)
- ✅ Repository scanning and parsing
- ✅ Graph retrieval and visualization
- ✅ Neo4j schema initialization
- ✅ Graph seeding to database
- ✅ Metrics calculation
- ✅ Impact analysis with BFS traversal
- ✅ Neo4j integer normalization for frontend
- ✅ Comprehensive error handling

### Planned Features (v1.1.0)
- 🔄 Authentication and authorization
- 🔄 Real-time WebSocket updates
- 🔄 Advanced filtering and search
- 🔄 Custom impact filters
- 🔄 Export functionality
- 🔄 Batch operations

---

## Support & Troubleshooting

### Common Issues

**"Neo4j is not configured"**
- Set `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` in `.env`
- Verify Neo4j server is running
- Check connection string format

**"Repository cloning failed"**
- Verify repository URL is public and accessible
- Check network connectivity
- Insufficient disk space

**"No graph found for repoId"**
- Run `/api/scan` first to create graph
- Check repoId matches scan output
- Graph file may have been deleted

---

## API Versioning

Current version: **v1.0.0**

Future versions will support:
- Version prefix in routes: `/api/v1/scan`
- Backward compatibility for 2+ major versions
- Deprecation notices

---

**End of Documentation**
