# AI-Engine Static Parser (Tree-sitter)

This module implements a **pure static code-analysis pipeline** that scans a repository, parses source files with Tree-sitter, extracts structural dependencies from ASTs, and exports a graph-shaped JSON payload suitable for Neo4j ingestion.

It also includes an optional **LLM intelligence layer** (OpenAI) that runs *after* graph creation and generates insights/predictions/explanations from graph data.

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
7. **LLM intelligence layer (optional)**: infers hidden dependencies, API contracts, database lineage, impact predictions, and natural-language architecture summaries.

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

Run with LLM analysis (post-parsing layer):

```bash
npm run analyze -- --repo ../Frontend --out ./output/frontend-graph-with-insights.json --with-llm
```

Optional model override:

```bash
npm run analyze -- --repo ../Frontend --out ./output/frontend-graph-with-insights.json --with-llm --model gpt-4.1-mini
```

## Environment

Create/update `.env` in `AI-Engine`:

```env
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_MODE=responses
OPENAI_MODEL=gpt-4.1-mini
LLM_MAX_NODES=500
LLM_MAX_EDGES=1000
```

- `OPENAI_API_KEY`: required for LLM layer.
- `OPENAI_BASE_URL`: optional; set this for OpenAI-compatible providers.
- `OPENAI_API_MODE`: `responses` (default) or `chat` for providers that only support chat completions.
- `OPENAI_MODEL`: optional default model.
- `LLM_MAX_NODES` / `LLM_MAX_EDGES`: controls graph context size sent to the LLM.

Example for an OpenAI-compatible hosted model:

```env
OPENAI_API_KEY=your_provider_key
OPENAI_BASE_URL=https://api.featherless.ai/v1
OPENAI_API_MODE=chat
OPENAI_MODEL=Qwen/Qwen3-0.6B
```

If `--with-llm` is enabled but `OPENAI_API_KEY` is missing, output includes `llmInsights.status = "skipped"`.

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

## LLM Insights Output

When `--with-llm` is used, output JSON also includes:

- `llmInsights.hiddenDependencies`
- `llmInsights.apiContracts`
- `llmInsights.databaseLineage`
- `llmInsights.impactPredictions`
- `llmInsights.explanations`
- `llmInsights.architectureSummary`
- `llmInsights.suggestedNewEdges`
