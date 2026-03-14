const path = require('path');
const { getNodeText, walkTree } = require('../utils/ast');
const { toProjectRelativePath } = require('../utils/paths');

const ENDPOINT_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all']);
const JS_LIKE_LANGUAGES = new Set(['javascript', 'typescript', 'tsx']);
const SQL_LIKE_LANGUAGES = new Set(['sql', 'postgresql']);

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
        (language === 'java' && node.type === 'method_invocation');

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
