const path = require('path');

const LANGUAGE_BY_EXTENSION = {
  '.js': {
    key: 'javascript',
    wasmPath: require.resolve('tree-sitter-wasms/out/tree-sitter-javascript.wasm'),
  },
  '.mjs': {
    key: 'javascript',
    wasmPath: require.resolve('tree-sitter-wasms/out/tree-sitter-javascript.wasm'),
  },
  '.cjs': {
    key: 'javascript',
    wasmPath: require.resolve('tree-sitter-wasms/out/tree-sitter-javascript.wasm'),
  },
  '.py': {
    key: 'python',
    wasmPath: require.resolve('tree-sitter-wasms/out/tree-sitter-python.wasm'),
  },
};

function detectLanguage(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return LANGUAGE_BY_EXTENSION[extension] ?? null;
}

function supportedExtensions() {
  return Object.keys(LANGUAGE_BY_EXTENSION);
}

module.exports = {
  detectLanguage,
  supportedExtensions,
};
