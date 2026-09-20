const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const YAML_PATH = path.join(__dirname, 'languages.yaml');

function loadLanguageConfig() {
  const raw = fs.readFileSync(YAML_PATH, 'utf8');
  const config = yaml.load(raw);

  if (!config || !Array.isArray(config.languages)) {
    throw new Error(`Invalid language configuration in ${YAML_PATH}: missing "languages" array`);
  }

  const extensionMap = {};

  for (const lang of config.languages) {
    if (!lang.name || !Array.isArray(lang.extensions)) {
      throw new Error(`Invalid language entry: ${JSON.stringify(lang)}`);
    }

    for (const ext of lang.extensions) {
      const normalized = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;

      if (extensionMap[normalized]) {
        throw new Error(
          `Duplicate extension "${normalized}" in language config: ` +
          `"${extensionMap[normalized].key}" and "${lang.name}"`,
        );
      }

      let wasmPath = null;
      if (lang.wasm_grammar) {
        try {
          wasmPath = require.resolve(`tree-sitter-wasms/out/${lang.wasm_grammar}.wasm`);
        } catch {
          throw new Error(
            `WASM grammar not found for "${lang.name}": ` +
            `tree-sitter-wasms/out/${lang.wasm_grammar}.wasm\n` +
            `Run "npm install" to install tree-sitter-wasms.`,
          );
        }
      }

      extensionMap[normalized] = {
        key: lang.name,
        wasmPath,
      };
    }
  }

  return extensionMap;
}

let LANGUAGE_BY_EXTENSION;

function getLanguageMap() {
  if (!LANGUAGE_BY_EXTENSION) {
    LANGUAGE_BY_EXTENSION = loadLanguageConfig();
  }
  return LANGUAGE_BY_EXTENSION;
}

function detectLanguage(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return getLanguageMap()[extension] ?? null;
}

function supportedExtensions() {
  return Object.keys(getLanguageMap());
}

module.exports = {
  detectLanguage,
  supportedExtensions,
};
