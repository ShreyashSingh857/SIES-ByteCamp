const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
const { builtinModules } = require('module');
const dotenv = require('dotenv');
const { runStaticAnalysis } = require('./pipeline/runStaticAnalysis');
const { detectLanguage } = require('./config/languages');
const { runDependencyAdvisor } = require('./llm/dependencyAdvisor');

dotenv.config();

const BUILTIN_MODULES = new Set(
  builtinModules
    .flatMap((item) => [item, item.replace(/^node:/, '')])
    .filter(Boolean),
);

function parseArguments(argv) {
  const args = {
    repo: null,
    out: null,
    changed: null,
    base: 'HEAD',
    includeUntracked: false,
    withLlm: false,
    model: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--repo') {
      args.repo = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token === '--out') {
      args.out = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token === '--changed') {
      args.changed = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token === '--base') {
      args.base = argv[index + 1] ?? 'HEAD';
      index += 1;
      continue;
    }

    if (token === '--include-untracked') {
      args.includeUntracked = true;
      continue;
    }

    if (token === '--with-llm') {
      args.withLlm = true;
      continue;
    }

    if (token === '--model') {
      args.model = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
  }

  return args;
}

function ensureDirectoryForFile(filePath) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
}

function splitLines(content) {
  return content
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

function toPosixPath(inputPath) {
  return inputPath.split(path.sep).join('/');
}

function safeReadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function findNearestPackageJson(startPath, repositoryPath) {
  const absoluteStart = path.resolve(startPath);
  let current = absoluteStart;

  while (current.startsWith(repositoryPath)) {
    const candidate = path.join(current, 'package.json');
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }

    current = parent;
  }

  return null;
}

function normalizeJsModuleName(moduleName) {
  if (!moduleName) {
    return null;
  }

  const cleaned = moduleName.trim();
  if (!cleaned || cleaned.startsWith('.') || cleaned.startsWith('/') || cleaned.startsWith('#')) {
    return null;
  }

  const normalized = cleaned.replace(/^node:/, '');
  if (BUILTIN_MODULES.has(normalized)) {
    return null;
  }

  if (cleaned.startsWith('@')) {
    const scopedParts = cleaned.split('/');
    if (scopedParts.length >= 2) {
      return `${scopedParts[0]}/${scopedParts[1]}`;
    }
    return cleaned;
  }

  return cleaned.split('/')[0];
}

function normalizePythonModuleName(moduleName) {
  if (!moduleName) {
    return null;
  }

  const cleaned = moduleName.trim();
  if (!cleaned || cleaned.startsWith('.')) {
    return null;
  }

  return cleaned.split('.')[0];
}

function normalizeImportedPackage(languageKey, moduleName) {
  if (languageKey === 'python') {
    return normalizePythonModuleName(moduleName);
  }

  return normalizeJsModuleName(moduleName);
}

function extractJsImports(source) {
  const imports = [];

  const importRegex = /import\s+(?:[^'";]+\s+from\s+)?["']([^"']+)["']/g;
  let importMatch;
  while ((importMatch = importRegex.exec(source)) !== null) {
    imports.push(importMatch[1]);
  }

  const requireRegex = /require\(\s*["']([^"']+)["']\s*\)/g;
  let requireMatch;
  while ((requireMatch = requireRegex.exec(source)) !== null) {
    imports.push(requireMatch[1]);
  }

  return imports;
}

function extractPythonImports(source) {
  const imports = [];
  const lines = splitLines(source);

  for (const line of lines) {
    if (line.startsWith('import ')) {
      const clause = line.slice('import '.length);
      const entries = clause.split(',').map((item) => item.trim()).filter(Boolean);
      for (const entry of entries) {
        imports.push(entry.split(' as ')[0].trim());
      }
      continue;
    }

    if (line.startsWith('from ')) {
      const match = line.match(/^from\s+([^\s]+)\s+import\s+/);
      if (match?.[1]) {
        imports.push(match[1]);
      }
    }
  }

  return imports;
}

function extractImportsByLanguage(language, source) {
  if (!source) {
    return [];
  }

  if (language === 'python') {
    return extractPythonImports(source);
  }

  return extractJsImports(source);
}

function getGitContext(repositoryPath) {
  const gitRoot = execSync('git rev-parse --show-toplevel', {
    cwd: repositoryPath,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

  const repositoryAbsolute = path.resolve(repositoryPath);
  const repositoryFromGitRoot = path.relative(gitRoot, repositoryAbsolute);
  const repositoryPrefix = repositoryFromGitRoot === '' ? '' : toPosixPath(repositoryFromGitRoot);

  return {
    gitRoot,
    repositoryAbsolute,
    repositoryPrefix,
  };
}

function toRepositoryRelativePath(gitRelativePath, gitContext) {
  const normalizedGitPath = gitRelativePath.replace(/\\/g, '/').replace(/^\.\//, '');

  if (!gitContext.repositoryPrefix) {
    return normalizedGitPath;
  }

  if (normalizedGitPath === gitContext.repositoryPrefix) {
    return '';
  }

  if (normalizedGitPath.startsWith(`${gitContext.repositoryPrefix}/`)) {
    return normalizedGitPath.slice(gitContext.repositoryPrefix.length + 1);
  }

  return null;
}

function getChangedFilesFromGit(repositoryPath, base, includeUntracked, gitContext) {
  const commandParts = ['git diff --name-only --diff-filter=ACMR'];
  if (base) {
    commandParts.push(base);
  }

  const diffOutput = execSync(commandParts.join(' '), {
    cwd: repositoryPath,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const changed = splitLines(diffOutput)
    .map((item) => toRepositoryRelativePath(item, gitContext))
    .filter(Boolean);

  if (!includeUntracked) {
    return Array.from(new Set(changed));
  }

  const untrackedOutput = execSync('git ls-files --others --exclude-standard', {
    cwd: repositoryPath,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const untracked = splitLines(untrackedOutput)
    .map((item) => toRepositoryRelativePath(item, gitContext))
    .filter(Boolean);

  return Array.from(new Set([...changed, ...untracked]));
}

function getFileSourceFromGit(repositoryPath, relativePath, base, gitContext) {
  try {
    const gitRelativePath = gitContext.repositoryPrefix
      ? `${gitContext.repositoryPrefix}/${relativePath.replace(/\\/g, '/')}`
      : relativePath.replace(/\\/g, '/');

    return execFileSync('git', ['show', `${base}:${gitRelativePath}`], {
      cwd: repositoryPath,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
}

function packageJsonDependencyNames(packageJson) {
  return new Set([
    ...Object.keys(packageJson?.dependencies ?? {}),
    ...Object.keys(packageJson?.devDependencies ?? {}),
    ...Object.keys(packageJson?.peerDependencies ?? {}),
    ...Object.keys(packageJson?.optionalDependencies ?? {}),
  ]);
}

function createImportUsageIndex(graph) {
  const usage = new Map();

  for (const edge of graph.edges ?? []) {
    if (edge.type !== 'IMPORTS' || !edge.to?.startsWith('module:')) {
      continue;
    }

    const rawModuleName = edge.to.slice('module:'.length);
    const normalized = normalizeJsModuleName(rawModuleName);
    if (!normalized) {
      continue;
    }

    if (!usage.has(normalized)) {
      usage.set(normalized, new Set());
    }

    usage.get(normalized).add(edge.from);
  }

  return usage;
}

function findImpactedFiles(importUsageIndex, packageName, changedFileId) {
  const users = Array.from(importUsageIndex.get(packageName) ?? []);
  return users.filter((fileId) => fileId !== changedFileId).sort();
}

function dependencyAgentSummary(recommendations) {
  const missingCount = recommendations.reduce((sum, item) => sum + item.missingDependencies.length, 0);
  const removableCount = recommendations.reduce((sum, item) => sum + item.removableCandidates.length, 0);

  return {
    changedFilesAnalyzed: recommendations.length,
    missingDependencies: missingCount,
    removableCandidates: removableCount,
  };
}

async function runDependencyChangeAgent(repositoryPath, options = {}) {
  const resolvedPath = path.resolve(repositoryPath);
  const base = options.base ?? 'HEAD';
  const includeUntracked = options.includeUntracked ?? false;
  const withLlm = options.withLlm ?? false;
  const model = options.model ?? null;
  const gitContext = getGitContext(resolvedPath);

  const inputChangedFiles = Array.isArray(options.changedFiles) ? options.changedFiles : null;
  const changedFiles = inputChangedFiles
    ? inputChangedFiles
    : getChangedFilesFromGit(resolvedPath, base, includeUntracked, gitContext);

  const sourceChangedFiles = changedFiles.filter((filePath) => detectLanguage(filePath));
  const graph = await runStaticAnalysis(resolvedPath, { withLlm: false });
  const importUsageIndex = createImportUsageIndex(graph);

  const recommendations = [];

  for (const relativeFilePath of sourceChangedFiles) {
    const absoluteFilePath = path.join(resolvedPath, relativeFilePath);
    if (!fs.existsSync(absoluteFilePath)) {
      continue;
    }

    const language = detectLanguage(absoluteFilePath);
    if (!language) {
      continue;
    }

    const newSource = fs.readFileSync(absoluteFilePath, 'utf8');
    const oldSource = getFileSourceFromGit(resolvedPath, relativeFilePath, base, gitContext);

    const newImports = extractImportsByLanguage(language.key, newSource);
    const oldImports = extractImportsByLanguage(language.key, oldSource || '');

    const newPackageSet = new Set(newImports.map((item) => normalizeImportedPackage(language.key, item)).filter(Boolean));
    const oldPackageSet = new Set(oldImports.map((item) => normalizeImportedPackage(language.key, item)).filter(Boolean));

    const addedPackages = Array.from(newPackageSet).filter((item) => !oldPackageSet.has(item)).sort();
    const removedPackages = Array.from(oldPackageSet).filter((item) => !newPackageSet.has(item)).sort();

    const packageJsonPath = findNearestPackageJson(path.dirname(absoluteFilePath), resolvedPath);
    const packageJson = packageJsonPath ? safeReadJson(packageJsonPath) : null;
    const declaredDependencies = packageJsonDependencyNames(packageJson);

    const fileId = `file:${relativeFilePath.replace(/\\/g, '/')}`;
    const missingDependencies = addedPackages
      .filter((packageName) => !declaredDependencies.has(packageName))
      .map((packageName) => ({
        packageName,
        dependencyFile: packageJsonPath ? path.relative(resolvedPath, packageJsonPath).split(path.sep).join('/') : null,
        impactedFiles: findImpactedFiles(importUsageIndex, packageName, fileId),
        action: 'add',
      }));

    const removableCandidates = removedPackages
      .filter((packageName) => (importUsageIndex.get(packageName)?.size ?? 0) === 0)
      .map((packageName) => ({
        packageName,
        dependencyFile: packageJsonPath ? path.relative(resolvedPath, packageJsonPath).split(path.sep).join('/') : null,
        action: 'consider-remove',
      }));

    if (!missingDependencies.length && !removableCandidates.length) {
      continue;
    }

    recommendations.push({
      file: relativeFilePath.replace(/\\/g, '/'),
      language: language.key,
      addedPackages,
      removedPackages,
      missingDependencies,
      removableCandidates,
    });
  }

  const result = {
    status: 'ok',
    generatedAt: new Date().toISOString(),
    repositoryPath: resolvedPath,
    base,
    includeUntracked,
    changedFiles,
    analyzedSourceFiles: sourceChangedFiles,
    summary: dependencyAgentSummary(recommendations),
    recommendations,
  };

  if (withLlm) {
    result.llmRecommendations = await runDependencyAdvisor(
      {
        repositoryPath: result.repositoryPath,
        base: result.base,
        summary: result.summary,
        recommendations: result.recommendations,
      },
      { model },
    );
  }

  return result;
}

async function main() {
  const args = parseArguments(process.argv.slice(2));

  if (!args.repo) {
    console.error('Usage: node src/agent.js --repo <repositoryPath> [--out <outputJsonPath>] [--base <gitRef>] [--changed <comma-separated-relative-paths>] [--include-untracked] [--with-llm] [--model <openai-model>]');
    process.exit(1);
  }

  const changedFiles = args.changed
    ? args.changed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    : null;

  const result = await runDependencyChangeAgent(args.repo, {
    changedFiles,
    base: args.base,
    includeUntracked: args.includeUntracked,
    withLlm: args.withLlm,
    model: args.model,
  });

  const output = JSON.stringify(result, null, 2);
  if (args.out) {
    const outputPath = path.resolve(args.out);
    ensureDirectoryForFile(outputPath);
    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`Dependency recommendations exported: ${outputPath}`);
    return;
  }

  console.log(output);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  runDependencyChangeAgent,
  main,
};
