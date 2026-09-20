const path = require('path');
const { getNodeText, walkTree } = require('../utils/ast');
const { toProjectRelativePath } = require('../utils/paths');

const ENDPOINT_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all']);
const JS_LIKE_LANGUAGES = new Set(['javascript', 'typescript', 'tsx']);
const SQL_LIKE_LANGUAGES = new Set(['sql', 'postgresql']);
const C_LIKE_LANGUAGES = new Set(['c', 'cpp', 'rust']);
const GO_LIKE_LANGUAGES = new Set(['go']);
const PHP_LIKE_LANGUAGES = new Set(['php']);
const RUBY_LIKE_LANGUAGES = new Set(['ruby']);
const CSHARP_LANGUAGES = new Set(['c_sharp']);
const KOTLIN_LANGUAGES = new Set(['kotlin']);
const SWIFT_LANGUAGES = new Set(['swift']);
const BASH_LIKE_LANGUAGES = new Set(['bash']);
const HTML_LIKE_LANGUAGES = new Set(['html']);
const CSS_LIKE_LANGUAGES = new Set(['css']);
const DATA_LANGUAGES = new Set(['json', 'yaml']);
const LUA_LIKE_LANGUAGES = new Set(['lua']);
const ELIXIR_LIKE_LANGUAGES = new Set(['elixir']);
const SCALA_LIKE_LANGUAGES = new Set(['scala']);
const DART_LIKE_LANGUAGES = new Set(['dart']);

function fileNodeId(relativePath) {
  return `file:${relativePath}`;
}

function functionNodeId(relativePath, functionName) {
  return `function:${relativePath}#${functionName}`;
}

function moduleNodeId(moduleName) {
  return `module:${moduleName}`;
}

function symbolNodeId(symbolName) {
  return `symbol:${symbolName}`;
}

function endpointNodeId(relativePath, method, routePath) {
  return `endpoint:${relativePath}:${method.toUpperCase()}:${routePath}`;
}

function databaseNodeId(name) {
  return `database:${name}`;
}

function externalServiceNodeId(name) {
  return `service:${name}`;
}

function getStringLiteralValue(text) {
  const match = text.match(/^[`'\"](.*)[`'\"]$/s);
  if (!match) {
    return null;
  }
  return match[1];
}

function extractRoutePathFromCall(node, source, language) {
  if (JS_LIKE_LANGUAGES.has(language)) {
    const firstArgument = node.namedChildren[1];
    if (!firstArgument) {
      return null;
    }
    return getStringLiteralValue(getNodeText(firstArgument, source));
  }

  if (language === 'python') {
    const argumentList = node.namedChildren.find((child) => child.type === 'argument_list');
    if (!argumentList || !argumentList.namedChildren.length) {
      return null;
    }

    const firstArgument = argumentList.namedChildren[0];
    if (!firstArgument) {
      return null;
    }

    return getStringLiteralValue(getNodeText(firstArgument, source));
  }

  return null;
}

function looksLikeApiObjectName(text) {
  const lower = text.toLowerCase();
  return lower === 'app' || lower === 'router' || lower.includes('router') || lower.includes('api') || lower.includes('server');
}

function parseJsImportStatement(text) {
  const fromMatch = text.match(/from\s+['\"]([^'\"]+)['\"]/);
  if (fromMatch) {
    return fromMatch[1];
  }

  const sideEffectMatch = text.match(/import\s+['\"]([^'\"]+)['\"]/);
  if (sideEffectMatch) {
    return sideEffectMatch[1];
  }

  return null;
}

function parsePythonImports(text) {
  const imports = [];
  const normalized = text.replace(/\s+/g, ' ').trim();

  if (normalized.startsWith('import ')) {
    const importClause = normalized.slice('import '.length);
    const modules = importClause.split(',').map((item) => item.trim()).filter(Boolean);
    for (const moduleEntry of modules) {
      const [moduleName] = moduleEntry.split(' as ').map((part) => part.trim());
      if (moduleName) {
        imports.push(moduleName);
      }
    }
    return imports;
  }

  if (normalized.startsWith('from ')) {
    const match = normalized.match(/^from\s+([^\s]+)\s+import\s+/);
    if (match) {
      imports.push(match[1]);
    }
  }

  return imports;
}

function parseCIncludes(text) {
  const matches = [];
  const allMatches = text.matchAll(/#include\s*[<"]([^>"]+)[>"]/g);
  for (const m of allMatches) {
    const header = m[1];
    if (header.endsWith('.h') || header.endsWith('.hpp')) {
      continue;
    }
    matches.push(header);
  }
  return matches;
}

function parseRustUseStatements(text) {
  const imports = [];
  const normalized = text.replace(/\s+/g, ' ').trim();
  const simpleMatch = normalized.match(/^use\s+([\w:]+)/);
  if (simpleMatch) {
    const p = simpleMatch[1];
    const segments = p.split('::');
    const modulePath = segments.length > 1 ? segments.slice(0, -1).join('::') : segments[0];
    imports.push(modulePath);
  }
  const groupMatch = normalized.match(/^use\s+([\w:]+)\s*\{([^}]+)\}/);
  if (groupMatch) {
    imports.push(groupMatch[1]);
  }
  return imports;
}

function parseGoImports(text) {
  const imports = [];
  const allMatches = text.matchAll(/import\s+(?:\(\s*)?["']([^"']+)["']/g);
  for (const m of allMatches) {
    imports.push(m[1]);
  }
  return imports;
}

function parsePhpImports(text) {
  const imports = [];
  const match = text.match(/(?:use|require|include|require_once|include_once)\s*(?:\(\s*)?['"]([^'"]+)['"]/);
  if (match) {
    imports.push(match[1]);
  }
  return imports;
}

function parseRubyRequires(text) {
  const imports = [];
  const match = text.match(/(?:require|load|require_relative)\s+['"]([^'"]+)['"]/);
  if (match) {
    imports.push(match[1]);
  }
  return imports;
}

function parseCSharpUsings(text) {
  const imports = [];
  const match = text.match(/using\s+(?:static\s+)?([\w.]+)\s*;/);
  if (match) {
    imports.push(match[1]);
  }
  return imports;
}

function parseKotlinImports(text) {
  const imports = [];
  const match = text.match(/import\s+([\w.]+)/);
  if (match) {
    imports.push(match[1]);
  }
  return imports;
}

function parseSwiftImports(text) {
  const imports = [];
  const match = text.match(/import\s+([\w]+)/);
  if (match) {
    imports.push(match[1]);
  }
  return imports;
}

function parseBashSource(text) {
  const imports = [];
  const match = text.match(/(?:source|\.)\s+['"]?([^'";\s]+)['"]?/);
  if (match) {
    imports.push(match[1]);
  }
  return imports;
}

function parseScalaImports(text) {
  const imports = [];
  const match = text.match(/import\s+([\w.]+)/);
  if (match) {
    imports.push(match[1]);
  }
  return imports;
}

function parseElixirRequires(text) {
  const imports = [];
  const match = text.match(/(?:require|import|use|alias)\s+([\w.]+)/);
  if (match) {
    imports.push(match[1]);
  }
  return imports;
}

function parseDartImports(text) {
  const imports = [];
  const match = text.match(/import\s+['"]([^'"]+)['"]/);
  if (match) {
    imports.push(match[1]);
  }
  return imports;
}

function parseLuaRequires(text) {
  const imports = [];
  const match = text.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
  if (match) {
    imports.push(match[1]);
  }
  return imports;
}

function extractHtmlResourceRefs(source) {
  const refs = [];
  const scriptMatches = source.matchAll(/<script[^>]+src\s*=\s*["']([^"']+)["']/gi);
  for (const m of scriptMatches) {
    if (m[1]) refs.push(m[1]);
  }
  const linkMatches = source.matchAll(/<link[^>]+href\s*=\s*["']([^"']+)["']/gi);
  for (const m of linkMatches) {
    if (m[1]) refs.push(m[1]);
  }
  return refs;
}

function extractCssImports(source) {
  const refs = [];
  const importMatches = source.matchAll(/@import\s+(?:url\()?['"]?([^'")\s;]+)['"]?\)?/gi);
  for (const m of importMatches) {
    if (m[1]) refs.push(m[1]);
  }
  return refs;
}

function normalizeCallableName(calleeText) {
  const cleaned = calleeText.replace(/\?/g, '').trim();
  const parts = cleaned.split('.').map((part) => part.trim()).filter(Boolean);
  const leaf = parts.length ? parts[parts.length - 1] : cleaned;
  return leaf.replace(/\(.*\)$/g, '').trim();
}

function getCalleeText(node, source, language) {
  if (JS_LIKE_LANGUAGES.has(language)) {
    const functionNode = node.childForFieldName('function');
    return functionNode ? getNodeText(functionNode, source).trim() : null;
  }

  if (language === 'python') {
    const functionNode = node.childForFieldName('function');
    return functionNode ? getNodeText(functionNode, source).trim() : null;
  }

  if (language === 'java') {
    const nameNode = node.childForFieldName('name');
    return nameNode ? getNodeText(nameNode, source).trim() : getNodeText(node, source).trim();
  }

  if (C_LIKE_LANGUAGES.has(language) || GO_LIKE_LANGUAGES.has(language)) {
    const functionNode = node.childForFieldName('function');
    if (functionNode) {
      return getNodeText(functionNode, source).trim();
    }
    const nameNode = node.childForFieldName('name');
    return nameNode ? getNodeText(nameNode, source).trim() : getNodeText(node, source).trim();
  }

  if (PHP_LIKE_LANGUAGES.has(language)) {
    const nameNode = node.childForFieldName('name');
    return nameNode ? getNodeText(nameNode, source).trim() : getNodeText(node, source).trim();
  }

  if (RUBY_LIKE_LANGUAGES.has(language)) {
    const nameNode = node.childForFieldName('name');
    return nameNode ? getNodeText(nameNode, source).trim() : getNodeText(node, source).trim();
  }

  if (CSHARP_LANGUAGES.has(language) || KOTLIN_LANGUAGES.has(language) || SWIFT_LANGUAGES.has(language)) {
    const nameNode = node.childForFieldName('name');
    return nameNode ? getNodeText(nameNode, source).trim() : getNodeText(node, source).trim();
  }

  if (BASH_LIKE_LANGUAGES.has(language)) {
    const text = getNodeText(node, source).trim();
    return text.split(/\s/)[0] || null;
  }

  if (LUA_LIKE_LANGUAGES.has(language)) {
    const functionNode = node.childForFieldName('function');
    if (functionNode) {
      return getNodeText(functionNode, source).trim();
    }
    const nameNode = node.childForFieldName('name');
    return nameNode ? getNodeText(nameNode, source).trim() : null;
  }

  if (ELIXIR_LIKE_LANGUAGES.has(language) || SCALA_LIKE_LANGUAGES.has(language) || DART_LIKE_LANGUAGES.has(language)) {
    const nameNode = node.childForFieldName('name');
    return nameNode ? getNodeText(nameNode, source).trim() : getNodeText(node, source).trim();
  }

  return null;
}

function findDbTechnology(calleeText) {
  const lower = calleeText.toLowerCase();
  const mapping = [
    ['prisma', 'Prisma'],
    ['mongoose', 'MongoDB'],
    ['sequelize', 'SQL'],
    ['knex', 'SQL'],
    ['mongodb', 'MongoDB'],
    ['mysql', 'MySQL'],
    ['postgres', 'PostgreSQL'],
    ['pg.', 'PostgreSQL'],
    ['redis', 'Redis'],
    ['db.', 'Database'],
    ['database', 'Database'],
    ['model.', 'Database'],
    ['gorm', 'SQL'],
    ['sqlx', 'SQL'],
    ['diesel', 'SQL'],
    ['hibernate', 'SQL'],
    ['jpa', 'SQL'],
    ['activerecord', 'SQL'],
    ['sequel', 'SQL'],
    ['datamapper', 'SQL'],
  ];

  for (const [token, name] of mapping) {
    if (lower.includes(token)) {
      return name;
    }
  }

  return null;
}

function parseUrlHost(text) {
  try {
    const url = new URL(text);
    return url.host;
  } catch {
    return null;
  }
}

function detectExternalService(calleeText, argumentTexts) {
  const lower = calleeText.toLowerCase();

  for (const argumentText of argumentTexts) {
    const value = getStringLiteralValue(argumentText);
    if (!value) {
      continue;
    }

    const host = parseUrlHost(value);
    if (host) {
      return host;
    }
  }

  if (lower.startsWith('axios') || lower === 'fetch' || lower.startsWith('got') || lower.startsWith('http.') || lower.startsWith('https.')) {
    return calleeText.split('.')[0];
  }

  if (lower.startsWith('requests') || lower.startsWith('httpx') || lower.startsWith('aiohttp') || lower.startsWith('urllib')) {
    return calleeText.split('.')[0];
  }

  if (lower.startsWith('net/http') || lower.startsWith('http.')) {
    return 'http';
  }

  if (lower.startsWith('reqwest') || lower.startsWith('hyper')) {
    return calleeText.split('.')[0];
  }

  if (lower.startsWith('curl') || lower.startsWith('wget')) {
    return calleeText.split('.')[0];
  }

  if (lower.startsWith('httpclient') || lower.startsWith('httparty') || lower.startsWith('faraday')) {
    return calleeText.split('.')[0];
  }

  if (lower.startsWith('guzzle') || lower.startsWith('curl')) {
    return calleeText.split('.')[0];
  }

  if (lower.startsWith('restclient') || lower.startsWith('open-uri')) {
    return calleeText.split('.')[0];
  }

  if (lower.startsWith(' dio') || lower.startsWith('http')) {
    return calleeText.split('.')[0];
  }

  if (lower.startsWith('nsurlsession') || lower.startsWith('alamofire')) {
    return calleeText.split('.')[0];
  }

  if (lower.startsWith('okhttp') || lower.startsWith('retrofit') || lower.startsWith('ktor')) {
    return calleeText.split('.')[0];
  }

  if (lower.startsWith('web') && lower.includes('request')) {
    return calleeText.split('.')[0];
  }

  return null;
}

function collectDeclaredFunctions(rootNode, source, language, relativePath, graph) {
  const declarationMap = new Map();

  function declareFunction(name, node) {
    if (!name) {
      return;
    }

    const id = functionNodeId(relativePath, name);
    declarationMap.set(name, id);

    graph.upsertNode({
      id,
      type: 'FUNCTION',
      name,
      file: relativePath,
      line: node.startPosition.row + 1,
    });
  }

  walkTree(rootNode, (node) => {
    if (JS_LIKE_LANGUAGES.has(language)) {
      if (node.type === 'function_declaration' || node.type === 'method_definition') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          declareFunction(getNodeText(nameNode, source), node);
        }
      }

      if (node.type === 'variable_declarator') {
        const valueNode = node.childForFieldName('value');
        if (!valueNode) {
          return;
        }

        if (valueNode.type !== 'arrow_function' && valueNode.type !== 'function') {
          return;
        }

        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          declareFunction(getNodeText(nameNode, source), node);
        }
      }
    }

    if (language === 'python' && node.type === 'function_definition') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        declareFunction(getNodeText(nameNode, source), node);
      }
    }

    if (language === 'java' && node.type === 'method_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        declareFunction(getNodeText(nameNode, source), node);
      }
    }

    if (C_LIKE_LANGUAGES.has(language)) {
      if (node.type === 'function_definition' || node.type === 'function_item') {
        const declaratorNode = node.childForFieldName('declarator') || node.childForFieldName('name');
        if (declaratorNode) {
          declareFunction(getNodeText(declaratorNode, source).replace(/\(.*/, ''), node);
        }
      }
    }

    if (language === 'go' && node.type === 'function_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        declareFunction(getNodeText(nameNode, source), node);
      }
    }

    if (PHP_LIKE_LANGUAGES.has(language) && node.type === 'function_definition') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        declareFunction(getNodeText(nameNode, source), node);
      }
    }

    if (RUBY_LIKE_LANGUAGES.has(language) && node.type === 'method') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        declareFunction(getNodeText(nameNode, source), node);
      }
    }

    if (CSHARP_LANGUAGES.has(language) && node.type === 'method_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        declareFunction(getNodeText(nameNode, source), node);
      }
    }

    if (KOTLIN_LANGUAGES.has(language) && node.type === 'function_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        declareFunction(getNodeText(nameNode, source), node);
      }
    }

    if (SWIFT_LANGUAGES.has(language) && node.type === 'function_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        declareFunction(getNodeText(nameNode, source), node);
      }
    }

    if (BASH_LIKE_LANGUAGES.has(language) && node.type === 'function_definition') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        declareFunction(getNodeText(nameNode, source), node);
      }
    }

    if (LUA_LIKE_LANGUAGES.has(language) && node.type === 'function_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        declareFunction(getNodeText(nameNode, source), node);
      }
    }

    if (ELIXIR_LIKE_LANGUAGES.has(language) && node.type === 'function_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        declareFunction(getNodeText(nameNode, source), node);
      }
    }

    if (SCALA_LIKE_LANGUAGES.has(language) && (node.type === 'function_definition' || node.type === 'val_definition')) {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        declareFunction(getNodeText(nameNode, source), node);
      }
    }

    if (DART_LIKE_LANGUAGES.has(language) && (node.type === 'function_signature' || node.type === 'constructor_declaration')) {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        declareFunction(getNodeText(nameNode, source), node);
      }
    }
  });

  return declarationMap;
}

function getCurrentFunctionContext(node, source, language, relativePath, declarationMap, existingContext) {
  if (JS_LIKE_LANGUAGES.has(language)) {
    if (node.type === 'function_declaration' || node.type === 'method_definition') {
      const nameNode = node.childForFieldName('name');
      const name = nameNode ? getNodeText(nameNode, source) : null;
      if (name) {
        return declarationMap.get(name) ?? functionNodeId(relativePath, name);
      }
    }

    if (node.type === 'variable_declarator') {
      const valueNode = node.childForFieldName('value');
      if (!valueNode || (valueNode.type !== 'arrow_function' && valueNode.type !== 'function')) {
        return existingContext;
      }

      const nameNode = node.childForFieldName('name');
      const name = nameNode ? getNodeText(nameNode, source) : null;
      if (name) {
        return declarationMap.get(name) ?? functionNodeId(relativePath, name);
      }
    }
  }

  if (language === 'python' && node.type === 'function_definition') {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? getNodeText(nameNode, source) : null;
    if (name) {
      return declarationMap.get(name) ?? functionNodeId(relativePath, name);
    }
  }

  if (language === 'java' && node.type === 'method_declaration') {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? getNodeText(nameNode, source) : null;
    if (name) {
      return declarationMap.get(name) ?? functionNodeId(relativePath, name);
    }
  }

  if (C_LIKE_LANGUAGES.has(language)) {
    if (node.type === 'function_definition' || node.type === 'function_item') {
      const declaratorNode = node.childForFieldName('declarator') || node.childForFieldName('name');
      if (declaratorNode) {
        const name = getNodeText(declaratorNode, source).replace(/\(.*/, '');
        if (name) {
          return declarationMap.get(name) ?? functionNodeId(relativePath, name);
        }
      }
    }
  }

  if (language === 'go' && node.type === 'function_declaration') {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? getNodeText(nameNode, source) : null;
    if (name) {
      return declarationMap.get(name) ?? functionNodeId(relativePath, name);
    }
  }

  if (PHP_LIKE_LANGUAGES.has(language) && node.type === 'function_definition') {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? getNodeText(nameNode, source) : null;
    if (name) {
      return declarationMap.get(name) ?? functionNodeId(relativePath, name);
    }
  }

  if (RUBY_LIKE_LANGUAGES.has(language) && node.type === 'method') {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? getNodeText(nameNode, source) : null;
    if (name) {
      return declarationMap.get(name) ?? functionNodeId(relativePath, name);
    }
  }

  if (CSHARP_LANGUAGES.has(language) && node.type === 'method_declaration') {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? getNodeText(nameNode, source) : null;
    if (name) {
      return declarationMap.get(name) ?? functionNodeId(relativePath, name);
    }
  }

  if (KOTLIN_LANGUAGES.has(language) && node.type === 'function_declaration') {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? getNodeText(nameNode, source) : null;
    if (name) {
      return declarationMap.get(name) ?? functionNodeId(relativePath, name);
    }
  }

  if (SWIFT_LANGUAGES.has(language) && node.type === 'function_declaration') {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? getNodeText(nameNode, source) : null;
    if (name) {
      return declarationMap.get(name) ?? functionNodeId(relativePath, name);
    }
  }

  if (BASH_LIKE_LANGUAGES.has(language) && node.type === 'function_definition') {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? getNodeText(nameNode, source) : null;
    if (name) {
      return declarationMap.get(name) ?? functionNodeId(relativePath, name);
    }
  }

  return existingContext;
}

function extractImports(node, language, source) {
  const imports = [];

  if (JS_LIKE_LANGUAGES.has(language)) {
    if (node.type === 'import_statement') {
      const moduleName = parseJsImportStatement(getNodeText(node, source));
      if (moduleName) {
        imports.push(moduleName);
      }
    }

    if (node.type === 'call_expression') {
      const text = getNodeText(node, source);
      const requireMatch = text.match(/require\(\s*['\"]([^'\"]+)['\"]\s*\)/);
      if (requireMatch) {
        imports.push(requireMatch[1]);
      }
    }
  }

  if (language === 'python' && (node.type === 'import_statement' || node.type === 'import_from_statement')) {
    imports.push(...parsePythonImports(getNodeText(node, source)));
  }

  if (language === 'java' && node.type === 'import_declaration') {
    const importText = getNodeText(node, source).replace(/^import\s+|;$/g, '').trim();
    if (importText) {
      imports.push(importText);
    }
  }

  if (C_LIKE_LANGUAGES.has(language) && node.type === 'preproc_include') {
    const pathNode = node.childForFieldName('path');
    if (pathNode) {
      imports.push(...parseCIncludes(getNodeText(pathNode, source)));
    } else {
      imports.push(...parseCIncludes(getNodeText(node, source)));
    }
  }

  if (language === 'rust' && node.type === 'use_declaration') {
    imports.push(...parseRustUseStatements(getNodeText(node, source)));
  }

  if (language === 'go' && (node.type === 'import_declaration' || node.type === 'import_spec')) {
    imports.push(...parseGoImports(getNodeText(node, source)));
  }

  if (PHP_LIKE_LANGUAGES.has(language)) {
    if (node.type === 'namespace_use_declaration' || node.type === 'require_expression' ||
        node.type === 'include_expression' || node.type === 'require_once_expression' ||
        node.type === 'include_once_expression') {
      imports.push(...parsePhpImports(getNodeText(node, source)));
    }
  }

  if (RUBY_LIKE_LANGUAGES.has(language)) {
    if (node.type === 'call' || node.type === 'method_call') {
      const text = getNodeText(node, source);
      if (/\b(require|load|require_relative)\b/.test(text)) {
        imports.push(...parseRubyRequires(text));
      }
    }
  }

  if (CSHARP_LANGUAGES.has(language) && node.type === 'using_directive') {
    imports.push(...parseCSharpUsings(getNodeText(node, source)));
  }

  if (KOTLIN_LANGUAGES.has(language) && node.type === 'import_header') {
    imports.push(...parseKotlinImports(getNodeText(node, source)));
  }

  if (SWIFT_LANGUAGES.has(language) && node.type === 'import_declaration') {
    imports.push(...parseSwiftImports(getNodeText(node, source)));
  }

  if (BASH_LIKE_LANGUAGES.has(language)) {
    if (node.type === 'command' || node.type === 'command_substitution') {
      const text = getNodeText(node, source);
      if (/\b(source|\.)\b/.test(text)) {
        imports.push(...parseBashSource(text));
      }
    }
  }

  if (LUA_LIKE_LANGUAGES.has(language) && node.type === 'function_call') {
    const text = getNodeText(node, source);
    if (/\brequire\b/.test(text)) {
      imports.push(...parseLuaRequires(text));
    }
  }

  if (ELIXIR_LIKE_LANGUAGES.has(language)) {
    if (node.type === 'call' || node.type === 'unqualified_call') {
      const text = getNodeText(node, source);
      if (/\b(require|import|use|alias)\b/.test(text)) {
        imports.push(...parseElixirRequires(text));
      }
    }
  }

  if (SCALA_LIKE_LANGUAGES.has(language) && node.type === 'import_declaration') {
    imports.push(...parseScalaImports(getNodeText(node, source)));
  }

  if (DART_LIKE_LANGUAGES.has(language) && node.type === 'import_or_export') {
    imports.push(...parseDartImports(getNodeText(node, source)));
  }

  if (HTML_LIKE_LANGUAGES.has(language) && node.type === 'script_element') {
    const srcAttr = node.children.find((c) => c.type === 'attribute' && getNodeText(c, source).includes('src'));
    if (srcAttr) {
      const match = getNodeText(srcAttr, source).match(/src\s*=\s*["']([^"']+)["']/);
      if (match) imports.push(match[1]);
    }
  }

  if (CSS_LIKE_LANGUAGES.has(language) && node.type === 'import_statement') {
    imports.push(...extractCssImports(getNodeText(node, source)));
  }

  return imports;
}

function addImportEdges(imports, fileId, graph) {
  for (const moduleName of imports) {
    const moduleId = moduleNodeId(moduleName);

    graph.upsertNode({
      id: moduleId,
      type: 'MODULE',
      name: moduleName,
    });

    graph.upsertEdge({
      from: fileId,
      to: moduleId,
      type: 'IMPORTS',
    });
  }
}

function extractSqlTableReferences(source) {
  const tables = new Set();
  const patterns = [
    /\bfrom\s+([a-zA-Z_][\w.]*)/gi,
    /\bjoin\s+([a-zA-Z_][\w.]*)/gi,
    /\bupdate\s+([a-zA-Z_][\w.]*)/gi,
    /\binsert\s+into\s+([a-zA-Z_][\w.]*)/gi,
    /\bdelete\s+from\s+([a-zA-Z_][\w.]*)/gi,
    /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?([a-zA-Z_][\w.]*)/gi,
    /\balter\s+table\s+([a-zA-Z_][\w.]*)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      tables.add(match[1].replace(/[`"']/g, ''));
    }
  }

  return Array.from(tables);
}

function extractSqlDependencies(source, fileId, graph) {
  const tables = extractSqlTableReferences(source);
  const dbTech = source.toLowerCase().includes('postgres') ? 'PostgreSQL' : 'SQL';
  const dbId = databaseNodeId(dbTech);

  graph.upsertNode({ id: dbId, type: 'DATABASE', name: dbTech });
  graph.upsertEdge({ from: fileId, to: dbId, type: 'READS' });

  for (const tableName of tables) {
    const tableId = databaseNodeId(`${dbTech}:${tableName}`);
    graph.upsertNode({ id: tableId, type: 'DATABASE', name: tableName, technology: dbTech });
    graph.upsertEdge({ from: fileId, to: tableId, type: 'READS' });
  }
}

function extractDependenciesFromAst(parsedFile, repositoryPath, graph) {
  const { filePath, source, tree, language } = parsedFile;
  const relativePath = toProjectRelativePath(repositoryPath, filePath);
  const fileId = fileNodeId(relativePath);

  graph.upsertNode({
    id: fileId,
    type: 'FILE',
    name: relativePath,
    language,
  });

  if (!tree || !tree.rootNode) {
    if (SQL_LIKE_LANGUAGES.has(language)) {
      extractSqlDependencies(source, fileId, graph);
    }
    return;
  }

  if (HTML_LIKE_LANGUAGES.has(language)) {
    const resourceRefs = extractHtmlResourceRefs(source);
    for (const ref of resourceRefs) {
      const refId = moduleNodeId(ref);
      graph.upsertNode({ id: refId, type: 'MODULE', name: ref });
      graph.upsertEdge({ from: fileId, to: refId, type: 'IMPORTS' });
    }
  }

  if (CSS_LIKE_LANGUAGES.has(language)) {
    const cssRefs = extractCssImports(source);
    for (const ref of cssRefs) {
      const refId = moduleNodeId(ref);
      graph.upsertNode({ id: refId, type: 'MODULE', name: ref });
      graph.upsertEdge({ from: fileId, to: refId, type: 'IMPORTS' });
    }
  }

  const declarationMap = collectDeclaredFunctions(tree.rootNode, source, language, relativePath, graph);

  walkTree(
    tree.rootNode,
    (node, context) => {
      const currentFunctionId = getCurrentFunctionContext(
        node,
        source,
        language,
        relativePath,
        declarationMap,
        context.currentFunctionId,
      );

      const imports = extractImports(node, language, source);
      if (imports.length) {
        addImportEdges(imports, fileId, graph);
      }

      const isCallExpression =
        (JS_LIKE_LANGUAGES.has(language) && node.type === 'call_expression') ||
        (language === 'python' && node.type === 'call') ||
        (language === 'java' && node.type === 'method_invocation') ||
        (C_LIKE_LANGUAGES.has(language) && (node.type === 'call_expression' || node.type === 'function_call')) ||
        (GO_LIKE_LANGUAGES.has(language) && node.type === 'call_expression') ||
        (PHP_LIKE_LANGUAGES.has(language) && node.type === 'function_call_expression') ||
        (RUBY_LIKE_LANGUAGES.has(language) && (node.type === 'call' || node.type === 'method_call')) ||
        (CSHARP_LANGUAGES.has(language) && node.type === 'invocation_expression') ||
        (KOTLIN_LANGUAGES.has(language) && node.type === 'call_expression') ||
        (SWIFT_LANGUAGES.has(language) && node.type === 'call_expression') ||
        (BASH_LIKE_LANGUAGES.has(language) && node.type === 'command') ||
        (LUA_LIKE_LANGUAGES.has(language) && node.type === 'function_call') ||
        (ELIXIR_LIKE_LANGUAGES.has(language) && (node.type === 'call' || node.type === 'function_call')) ||
        (SCALA_LIKE_LANGUAGES.has(language) && node.type === 'function_call') ||
        (DART_LIKE_LANGUAGES.has(language) && node.type === 'function_call');

      if (isCallExpression) {
        const calleeText = getCalleeText(node, source, language);
        if (calleeText) {
          const callerId = currentFunctionId || fileId;
          const normalizedCallName = normalizeCallableName(calleeText);

          if (normalizedCallName && normalizedCallName !== 'require') {
            const internalTargetId = declarationMap.get(normalizedCallName);
            const targetId = internalTargetId ?? symbolNodeId(normalizedCallName);

            if (!internalTargetId) {
              graph.upsertNode({
                id: targetId,
                type: 'SYMBOL',
                name: normalizedCallName,
              });
            }

            graph.upsertEdge({
              from: callerId,
              to: targetId,
              type: 'CALLS',
            });
          }

          const dbTechnology = findDbTechnology(calleeText);
          if (dbTechnology) {
            const dbId = databaseNodeId(dbTechnology);
            graph.upsertNode({
              id: dbId,
              type: 'DATABASE',
              name: dbTechnology,
            });
            graph.upsertEdge({
              from: callerId,
              to: dbId,
              type: 'READS',
            });
          }

          const argumentTexts = node.namedChildren
            .filter((child) => child.type !== 'identifier' && child.type !== 'attribute' && child.type !== 'member_expression')
            .map((child) => getNodeText(child, source).trim());

          const externalServiceName = detectExternalService(calleeText, argumentTexts);
          if (externalServiceName) {
            const externalId = externalServiceNodeId(externalServiceName);
            graph.upsertNode({
              id: externalId,
              type: 'EXTERNAL_SERVICE',
              name: externalServiceName,
            });
            graph.upsertEdge({
              from: callerId,
              to: externalId,
              type: 'CALLS',
            });
          }

          const methodParts = calleeText.split('.').map((part) => part.trim()).filter(Boolean);
          if (methodParts.length >= 2) {
            const objectName = methodParts[0];
            const method = methodParts[methodParts.length - 1].toLowerCase();
            const routePath = extractRoutePathFromCall(node, source, language);

            if (ENDPOINT_METHODS.has(method) && routePath && routePath.startsWith('/') && looksLikeApiObjectName(objectName)) {
              const endpointId = endpointNodeId(relativePath, method, routePath);
              graph.upsertNode({
                id: endpointId,
                type: 'API_ENDPOINT',
                method: method.toUpperCase(),
                path: routePath,
                file: relativePath,
                line: node.startPosition.row + 1,
              });
              graph.upsertEdge({
                from: fileId,
                to: endpointId,
                type: 'EXPOSES_API',
              });
            }
          }
        }
      }

      return {
        currentFunctionId,
      };
    },
    {
      currentFunctionId: null,
    },
  );
}

module.exports = {
  extractDependenciesFromAst,
};
