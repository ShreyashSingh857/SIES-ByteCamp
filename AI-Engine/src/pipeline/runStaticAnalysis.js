const path = require('path');
const { scanRepository } = require('./scanRepository');
const { parseFiles } = require('./parseFiles');
const { createGraphBuilder } = require('./graphBuilder');
const { extractDependenciesFromAst } = require('./extractDependencies');
const { runGraphIntelligence } = require('../llm/graphIntelligence');

async function runStaticAnalysis(repositoryPath, options = {}) {
  const resolvedPath = path.resolve(repositoryPath);
  const withLlm = options.withLlm ?? false;

  const scannedFiles = scanRepository(resolvedPath);
  const parsedFiles = await parseFiles(scannedFiles);
  const graphBuilder = createGraphBuilder();

  for (const parsedFile of parsedFiles) {
    extractDependenciesFromAst(parsedFile, resolvedPath, graphBuilder);
  }

  const graph = graphBuilder.toJSON();
  const result = {
    repositoryPath: resolvedPath,
    summary: {
      scannedFiles: scannedFiles.length,
      parsedFiles: parsedFiles.length,
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      languages: Array.from(new Set(scannedFiles.map((file) => file.language))).sort(),
    },
    ...graph,
  };

  if (withLlm) {
    result.llmInsights = await runGraphIntelligence(result, {
      model: options.model,
    });
  }

  return result;
}

module.exports = {
  runStaticAnalysis,
};
