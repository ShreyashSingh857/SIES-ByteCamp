const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { detectLanguage, supportedExtensions } = require('../src/config/languages');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS  ' + name);
  } catch (err) {
    failed++;
    console.error('  FAIL  ' + name);
    console.error('        ' + err.message);
  }
}

console.log('\n=== Language Registry Tests ===\n');

test('supportedExtensions returns a non-empty array', function () {
  const exts = supportedExtensions();
  assert(Array.isArray(exts) && exts.length > 0);
});

const extensionTests = [
  ['.js', 'javascript'], ['.mjs', 'javascript'], ['.cjs', 'javascript'], ['.jsx', 'javascript'],
  ['.ts', 'typescript'], ['.tsx', 'tsx'],
  ['.py', 'python'], ['.pyw', 'python'],
  ['.java', 'java'],
  ['.c', 'c'], ['.h', 'c'],
  ['.cpp', 'cpp'], ['.cxx', 'cpp'], ['.cc', 'cpp'], ['.hpp', 'cpp'],
  ['.go', 'go'],
  ['.rs', 'rust'],
  ['.php', 'php'],
  ['.rb', 'ruby'], ['.rake', 'ruby'],
  ['.cs', 'c_sharp'],
  ['.kt', 'kotlin'], ['.kts', 'kotlin'],
  ['.swift', 'swift'],
  ['.html', 'html'], ['.htm', 'html'], ['.vue', 'html'],
  ['.css', 'css'], ['.scss', 'css'], ['.less', 'css'],
  ['.json', 'json'],
  ['.yaml', 'yaml'], ['.yml', 'yaml'],
  ['.sh', 'bash'], ['.bash', 'bash'],
  ['.lua', 'lua'],
  ['.ex', 'elixir'], ['.exs', 'elixir'],
  ['.scala', 'scala'], ['.sc', 'scala'],
  ['.dart', 'dart'],
];

for (const ext of extensionTests) {
  test('detectLanguage(' + ext[0] + ') => ' + ext[1], function () {
    const lang = detectLanguage('test' + ext[0]);
    assert.strictEqual(lang.key, ext[1]);
  });
}

test('detectLanguage returns null for unsupported extension', function () {
  assert.strictEqual(detectLanguage('test.xyz'), null);
});

test('detectLanguage is case-insensitive', function () {
  assert.strictEqual(detectLanguage('TEST.JS').key, 'javascript');
  assert.strictEqual(detectLanguage('test.PY').key, 'python');
  assert.strictEqual(detectLanguage('test.GO').key, 'go');
});

test('detectLanguage handles nested paths', function () {
  assert.strictEqual(detectLanguage('/some/deep/path/test.rs').key, 'rust');
  assert.strictEqual(detectLanguage('src/main/java/App.java').key, 'java');
});

test('SQL and YAML and Dart extensions have null wasmPath', function () {
  assert.strictEqual(detectLanguage('test.sql').wasmPath, null);
  assert.strictEqual(detectLanguage('test.psql').wasmPath, null);
  assert.strictEqual(detectLanguage('test.pgsql').wasmPath, null);
  assert.strictEqual(detectLanguage('test.yaml').wasmPath, null);
  assert.strictEqual(detectLanguage('test.yml').wasmPath, null);
  assert.strictEqual(detectLanguage('test.dart').wasmPath, null);
});

test('WASM languages have valid wasmPath', function () {
  const langs = ['test.js', 'test.py', 'test.go', 'test.rs', 'test.php', 'test.rb', 'test.cs'];
  for (const f of langs) {
    const lang = detectLanguage(f);
    assert(lang && lang.wasmPath, 'Missing wasmPath for ' + f);
  }
});

console.log('\n=== YAML Config Tests ===\n');

test('languages.yaml loads correctly', function () {
  const yaml = require('js-yaml');
  const yamlPath = path.join(__dirname, '..', 'src', 'config', 'languages.yaml');
  const content = fs.readFileSync(yamlPath, 'utf8');
  const config = yaml.load(content);
  assert(Array.isArray(config.languages));
  assert(config.languages.length >= 25);
});

test('Each YAML entry has name, extensions, wasm_grammar', function () {
  const yaml = require('js-yaml');
  const yamlPath = path.join(__dirname, '..', 'src', 'config', 'languages.yaml');
  const content = fs.readFileSync(yamlPath, 'utf8');
  const config = yaml.load(content);
  for (const lang of config.languages) {
    assert(typeof lang.name === 'string');
    assert(Array.isArray(lang.extensions));
    assert(lang.wasm_grammar !== undefined);
  }
});

console.log('\n=== Summary ===\n');
console.log('  ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
