const path = require('path');
const { scanRepository } = require('./scanRepository');
const { parseFiles } = require('./parseFiles');
const { createGraphBuilder } = require('./graphBuilder');
const { extractDependenciesFromAst } = require('./extractDependencies');

async function runStaticAnalysis(repositoryPath) {
  const resolvedPath = path.resolve(repositoryPath);

  const scannedFiles = scanRepository(resolvedPath);
  const parsedFiles = await parseFiles(scannedFiles);
  const graphBuilder = createGraphBuilder();

  for (const parsedFile of parsedFiles) {
    extractDependenciesFromAst(parsedFile, resolvedPath, graphBuilder);
  }

  const graph = graphBuilder.toJSON();

  return {
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
}

module.exports = {
  runStaticAnalysis,
};
