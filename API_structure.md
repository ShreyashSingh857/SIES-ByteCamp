# PolyglotDepMap API Data Structures

This document outlines the validated JSON response structures for all connected backend endpoints.

---

## 1. Health Target
**Endpoint:** `GET /api/health`
**Description:** Returns the live status of the backend server.
```json
{
  "success": true,
  "status": "healthy",
  "uptime": 533.501,
  "timestamp": "2026-03-14T10:37:27.535Z"
}
```

---

## 2. Help Topics
**Endpoint:** `GET /api/help`
**Description:** Fetches all available help and support topics.
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "1",
      "title": "How do I register for an event?",
      "content": "To register, go to the Events page...",
      "category": "Registration"
    }
  ]
}
```

---

## 3. Help Search
**Endpoint:** `GET /api/help/search?q={keyword}`
**Description:** Filters the help topics by a specific keyword search.
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "2",
      "title": "I forgot my password. How can I reset it?",
      "content": "Click on the 'Forgot Password' link...",
      "category": "Account"
    }
  ]
}
```

---

## 4. Repository Scan and Parse
**Endpoint:** `POST /api/scan`
**Payload:** `{ "repoUrl": "https://github.com/mde/ejs" }`
**Description:** Clones a target repository, spawns the AI Engine, parses the repository for a dependency graph, and returns the stats.
```json
{
  "success": true,
  "message": "Repository cloned and parsed successfully",
  "data": {
    "repoUrl": "https://github.com/mde/ejs",
    "workspaceDir": "D:\\GitHub\\SIES-ByteCamp\\workspace",
    "repositoriesDir": "D:\\GitHub\\SIES-ByteCamp\\workspace\\repositories",
    "clonedRepoPath": "D:\\GitHub\\SIES-ByteCamp\\workspace\\repositories\\ejs-1773484...",
    "parserInputPath": "D:\\GitHub\\SIES-ByteCamp\\workspace\\repositories\\ejs-1773484...",
    "parserSummary": {
      "scannedFiles": 18,
      "parsedFiles": 18,
      "nodes": 190,
      "edges": 324,
      "languages": ["javascript"]
    }
  }
}
```

---

## 5. Dependency Graph Request
**Endpoint:** `GET /api/graph`
**Description:** Retrieves the in-memory array of parsed nodes and edges representing the architecture of the scanned codebase in the format utilized by Cytoscape JS.
```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "file:benchmark/bench-ejs.js",
        "type": "FILE",
        "name": "benchmark/bench-ejs.js",
        "language": "javascript"
      },
      {
        "id": "function:benchmark/bench-ejs.js#fill",
        "type": "FUNCTION",
        "name": "fill",
        "file": "benchmark/bench-ejs.js",
        "line": 97
      }
    ],
    "edges": [
      {
        "source": "function:benchmark/bench-ejs.js#fill",
        "target": "file:benchmark/bench-ejs.js",
        "type": "DEFINED_IN"
      }
    ]
  }
}
```

---

## 6. Impact Simulation Analysis (Graph Traversal)
**Endpoint:** `GET /api/impact?nodeId={id}`
**Description:** Computes the downstream blast-radius of modifying a specific node ID by using an AI Engine populated BFS traversal array.
```json
{
  "success": true,
  "data": {
    "directImpact": [
      "function:benchmark/bench-ejs.js#fill"
    ],
    "transitiveImpact": [
      "file:benchmark/bench-ejs.js"
    ],
    "summary": "Impact analysis for node file:benchmark/bench-ejs.js completed across 1 direct and 1 transitive connections."
  }
}
```
