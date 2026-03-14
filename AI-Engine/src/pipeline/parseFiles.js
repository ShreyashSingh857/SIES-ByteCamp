const fs = require('fs');
const { Parser, Language } = require('web-tree-sitter');
const { detectLanguage } = require('../config/languages');

let isParserInitialized = false;
const languageCache = new Map();

async function initializeParser() {
  if (isParserInitialized) {
    return;
  }

  const wasmPath = require.resolve('web-tree-sitter/tree-sitter.wasm');
  await Parser.init({
    locateFile(scriptName) {
      if (scriptName === 'tree-sitter.wasm') {
        return wasmPath;
      }

      return scriptName;
    },
  });

  isParserInitialized = true;
}

async function loadLanguage(languageConfig) {
  if (languageCache.has(languageConfig.key)) {
    return languageCache.get(languageConfig.key);
  }

  const loadedLanguage = await Language.load(languageConfig.wasmPath);
  languageCache.set(languageConfig.key, loadedLanguage);
  return loadedLanguage;
}

async function parseFiles(fileRecords) {
  await initializeParser();

  const parser = new Parser();
  const results = [];

  for (const file of fileRecords) {
    const language = detectLanguage(file.path);
    if (!language) {
      continue;
    }

    const source = fs.readFileSync(file.path, 'utf8');

  const loadedLanguage = await loadLanguage(language);
  parser.setLanguage(loadedLanguage);
    const tree = parser.parse(source);

    results.push({
      filePath: file.path,
      language: language.key,
      source,
      tree,
    });
  }

  return results;
}

module.exports = {
  parseFiles,
};
