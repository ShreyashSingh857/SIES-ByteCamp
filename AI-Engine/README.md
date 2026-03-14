# AI-Engine Static Parser (Tree-sitter)

This module implements a **pure static code-analysis pipeline** that scans a repository, parses source files with Tree-sitter, extracts structural dependencies from ASTs, and exports a graph-shaped JSON payload suitable for Neo4j ingestion.

## Pipeline

1. **Repository scan**: recursively scans directories and filters supported files (`.js`, `.mjs`, `.cjs`, `.py`).
2. **Language identification**: selects parser config by file extension.
3. **AST generation**: parses files via Tree-sitter into syntax trees.
4. **Tree traversal**: extracts dependency patterns:
   - module imports
   - internal/external function calls
   - API endpoint declarations
   - DB/service references
5. **Graph normalization**: converts extracted entities to `nodes` and relationships to `edges`.
6. **JSON export**: writes graph output for graph DB insertion and frontend visualization.

## Install

```bash
cd AI-Engine
npm install
```

## Run

```bash
npm run analyze -- --repo ../Backend --out ./output/dependency-graph.json
```

Or print JSON to stdout:

```bash
npm run analyze -- --repo ../Backend
```

## Output format

```json
{
  "repositoryPath": "...",
  "summary": {
    "scannedFiles": 0,
    "parsedFiles": 0,
    "nodes": 0,
    "edges": 0,
    "languages": ["javascript", "python"]
  },
  "nodes": [
    { "id": "file:src/app.js", "type": "FILE", "name": "src/app.js", "language": "javascript" }
  ],
  "edges": [
    { "from": "file:src/app.js", "to": "module:express", "type": "IMPORTS" }
  ]
}
```

## Relationship types

- `IMPORTS`
- `CALLS`
- `EXPOSES_API`
- `READS`
