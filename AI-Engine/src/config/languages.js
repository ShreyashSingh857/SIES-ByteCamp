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
  '.jsx': {
    key: 'javascript',
    wasmPath: require.resolve('tree-sitter-wasms/out/tree-sitter-javascript.wasm'),
  },
  '.py': {
    key: 'python',
    wasmPath: require.resolve('tree-sitter-wasms/out/tree-sitter-python.wasm'),
  },
  '.ts': {
    key: 'typescript',
    wasmPath: require.resolve('tree-sitter-wasms/out/tree-sitter-typescript.wasm'),
  },
  '.tsx': {
    key: 'tsx',
    wasmPath: require.resolve('tree-sitter-wasms/out/tree-sitter-tsx.wasm'),
  },
  '.java': {
    key: 'java',
    wasmPath: require.resolve('tree-sitter-wasms/out/tree-sitter-java.wasm'),
  },
  '.sql': {
    key: 'sql',
    wasmPath: null,
  },
  '.psql': {
    key: 'postgresql',
    wasmPath: null,
  },
  '.pgsql': {
    key: 'postgresql',
    wasmPath: null,
  },
  '.ddl': {
    key: 'sql',
    wasmPath: null,
  },
  '.dml': {
    key: 'sql',
    wasmPath: null,
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
