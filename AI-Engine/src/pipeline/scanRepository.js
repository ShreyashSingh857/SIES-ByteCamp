const fs = require('fs');
const path = require('path');
const { detectLanguage } = require('../config/languages');

const DEFAULT_IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '.cache',
  '__pycache__',
  '.venv',
  'venv',
  '.idea',
  '.vscode',
]);

function scanRepository(repositoryPath, options = {}) {
  const ignoredDirs = new Set([
    ...DEFAULT_IGNORED_DIRS,
    ...(options.ignoredDirs ?? []),
  ]);

  const discoveredFiles = [];

  function walk(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (ignoredDirs.has(entry.name)) {
          continue;
        }
        walk(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const language = detectLanguage(fullPath);
      if (!language) {
        continue;
      }

      discoveredFiles.push({
        path: fullPath,
        language: language.key,
      });
    }
  }

  walk(repositoryPath);

  return discoveredFiles;
}

module.exports = {
  scanRepository,
};
