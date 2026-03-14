# LLM + Neo4j Dependency Analysis - Complete Workflow

## System Overview

Your project now has a complete end-to-end system that:
1. **Analyzes** code repositories using AI-Engine with Qwen/Qwen3-0.6B LLM
2. **Identifies** both static and runtime dependencies with LLM intelligence
3. **Stores** the dependency graph in Neo4j database
4. **Serves** dependency data through Backend API
5. **Displays** interactive analysis in Frontend UI

## Architecture Layers

### Layer 1: AI-Engine (Code Analysis + LLM)
- **Tool**: AI-Engine with tree-sitter static analysis
- **LLM**: Qwen/Qwen3-0.6B via Featherless AI
- **Output**: JSON dependency graph with LLM classifications

### Layer 2: Neo4j Database (Graph Storage)
- **Container**: Neo4j Aura instance
- **Nodes**: Code elements (Files, Functions, Classes, APIs, DB Tables)
- **Edges**: Dependencies with relationship types and LLM insights
- **Indexes**: Optimized for fast querying by scanId

### Layer 3: Backend (API Orchestration)
- **Routes**: Express.js API endpoints
- **Import Service**: Ingests AI-Engine output into Neo4j
- **Query Service**: Retrieves dependencies from Neo4j
- **LLM Service**: Analyzes selected symbols using LLM

### Layer 4: Frontend (UI Interaction)
- **Component**: FileViewerWithDependencies.jsx
- **Interaction**: Select text in code → Query dependencies
- **Display**: Color-coded dependency types with LLM insights

## Complete Workflow

### Step 1: Analyze Repository with AI-Engine

```bash
cd "C:\Users\adity\Desktop\SIES-ByteCamp2\AI-Engine"
npm run analyze:with-llm
```

**What happens:**
- AI-Engine scans repository structure using tree-sitter
- Qwen LLM analyzes each dependency and classifies types
- Generates JSON with nodes, edges, and LLM insights
- Output saved to `./output/frontend-graph-with-insights.json`

**Output Structure:**
```json
{
  "nodes": [
    {
      "id": "func_123",
      "name": "fetchData",
      "type": "Function",
      "filePath": "src/api.js",
      "lineNumber": 45,
      "scope": "module",
      "llmClassification": "API Handler",
      "llmInsights": "Handles external API requests with retry logic"
    }
  ],
  "edges": [
    {
      "source": "func_123",
      "target": "func_456",
      "type": "CALLS",
      "staticDependency": true,
      "runtimeDependency": false,
      "scope": "module",
      "llmAnalysis": "Static call to utility function"
    }
  ]
}
```

### Step 2: Import Graph into Neo4j

**API Endpoint:** `POST /api/import/analyze-with-llm`

```bash
curl -X POST http://localhost:5000/api/import/analyze-with-llm \
  -H "Content-Type: application/json" \
  -d '{
    "repoPath": "C:\\Users\\adity\\Desktop\\SIES-ByteCamp2\\Frontend",
    "outputPath": "C:\\Users\\adity\\Desktop\\SIES-ByteCamp2\\output\\frontend-graph.json"
  }'
```

**Response:**
```json
{
  "success": true,
  "scanId": "550e8400-e29b-41d4-a716-446655440000",
  "importResult": {
    "success": true,
    "nodesImported": 1247,
    "edgesImported": 3856,
    "timestamp": "2026-03-14T10:30:00.000Z"
  },
  "aiEngineOutput": {
    "nodesAnalyzed": 1247,
    "edgesFound": 3856,
    "llmModel": "Qwen/Qwen3-0.6B",
    "outputFile": "..."
  }
}
```

**What happens in Neo4j:**
- Creates Scan node with metadata
- Creates all code element nodes (Functions, Classes, APIs, etc.)
- Creates relationship edges with dependency types
- Indexes nodes for fast querying
- Stores LLM classifications and insights

### Step 3: Query Dependencies

**Use the stored `scanId` to query dependencies:**

**API Endpoint:** `POST /api/analyze/dependencies-llm`

```bash
curl -X POST http://localhost:5000/api/analyze/dependencies-llm \
  -H "Content-Type: application/json" \
  -d '{
    "repoId": "your-repo-id",
    "scanId": "550e8400-e29b-41d4-a716-446655440000",
    "currentFile": "src/pages/Home.jsx",
    "selectedText": "useState",
    "withLLM": true
  }'
```

**Response includes:**
```json
{
  "success": true,
  "data": {
    "symbolOccurrences": [
      {
        "id": "state_001",
        "type": "State_Hook",
        "displayName": "useState",
        "filePath": "src/pages/Home.jsx",
        "lineNumber": 42,
        "context": "const [user, setUser] = useState(null)"
      }
    ],
    "dependencies": {
      "perNode": {
        "state_001": {
          "incoming": [
            {
              "sourceType": "Function",
              "sourceId": "func_render",
              "relationshipType": "USES_HOOK",
              "targetName": "useState",
              "targetType": "Hook"
            }
          ],
          "outgoing": []
        }
      }
    },
    "llmAnalysis": {
      "analysis": {
        "dependencyType": "runtime",
        "classification": "React Hook - State Management",
        "scope": "function",
        "impact": "HIGH - Used in rendering logic",
        "riskLevel": "LOW - Standard React pattern"
      }
    }
  }
}
```

### Step 4: Frontend Integration

**Frontend automatically:**
1. Stores scanId in localStorage when available
2. Detects text selection in code editor
3. Queries `/api/analyze/dependencies-llm` with scanId
4. Displays results with color-coded dependency types
5. Shows LLM insights for each dependency

## Database Management

### List All Scans
```bash
curl http://localhost:5000/api/import/scans
```

### Get Scan Statistics
```bash
curl http://localhost:5000/api/import/scans/{scanId}
```

### Delete Old Scan
```bash
curl -X DELETE http://localhost:5000/api/import/scans/{scanId}
```

## Environment Configuration

**AI-Engine (.env):**
```
OPENAI_API_KEY=rc_22c034049aa1cb45c94f34189a7db3aca96aebc74710ab1f643d5ddff5b58389
OPENAI_BASE_URL=https://api.featherless.ai/v1
OPENAI_MODEL=Qwen/Qwen3-0.6B
LLM_MAX_NODES=500
LLM_MAX_EDGES=1000
```

**Backend (.env):**
```
NEO4J_URI=neo4j+s://9d7d1649.databases.neo4j.io
NEO4J_USER=9d7d1649
NEO4J_PASSWORD=VfjDYBe5x4JOuJiy5V7MN22onRObVxkUliE4Vo-XZ2E
NEO4J_DATABASE=9d7d1649

OPENAI_API_KEY=rc_22c034049aa1cb45c94f34189a7db3aca96aebc74710ab1f643d5ddff5b58389
OPENAI_BASE_URL=https://api.featherless.ai/v1
OPENAI_MODEL=Qwen/Qwen3-0.6B
```

## Key Features

✅ **LLM-Powered Analysis** - Qwen model understands code semantics  
✅ **Static Dependencies** - Imports, function calls, class inheritance  
✅ **Runtime Dependencies** - Hooks, configuration, API calls  
✅ **Neo4j Storage** - Fast graph queries and traversal  
✅ **Relationship Tracking** - Multiple edge types with metadata  
✅ **LLM Insights** - Classification, scope, impact, risk assessment  
✅ **API Integration** - Clean REST endpoints for all operations  
✅ **Frontend Display** - Interactive UI with color coding  

## Quick Start

1. **Start Backend** (already running):
   ```bash
   cd Backend && npm run dev
   ```

2. **Analyze Repository**:
   ```bash
   cd AI-Engine && npm run analyze:with-llm
   ```

3. **Import to Neo4j**:
   ```bash
   curl -X POST http://localhost:5000/api/import/analyze-with-llm \
     -H "Content-Type: application/json" \
     -d '{"repoPath": "path/to/repo"}'
   ```

4. **Save scanId** from response

5. **Open Frontend** and start selecting text to see dependencies!

## Troubleshooting

**Neo4j Connection Issues:**
- Verify NEO4J_URI is accessible
- Check credentials are correct
- Ensure database is not full

**LLM API Errors:**
- Verify OPENAI_API_KEY is valid
- Check Featherless AI API is accessible
- Ensure API quota not exceeded

**Import Failures:**
- Ensure AI-Engine output file exists
- Check JSON is valid
- Verify Neo4j constraints not violated

---

**System Status**: ✅ Ready for use
**Last Updated**: March 14, 2026
