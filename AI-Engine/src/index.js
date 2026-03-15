const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { runStaticAnalysis } = require('./pipeline/runStaticAnalysis');

dotenv.config();

function parseArguments(argv) {
  const args = {
    repo: null,
    out: null,
    files: null,
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

    if (token === '--files') {
      args.files = argv[index + 1] ?? null;
      index += 1;
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

async function main() {
  const { repo, out, files, withLlm, model } = parseArguments(process.argv.slice(2));

  if (!repo) {
    console.error('Usage: node src/index.js --repo <repositoryPath> [--out <outputJsonPath>] [--files <changedFilesJsonPath>] [--with-llm] [--model <openai-model>]');
    process.exit(1);
  }

  let selectedFiles = null;
  if (files) {
    const filesPath = path.resolve(files);
    selectedFiles = JSON.parse(fs.readFileSync(filesPath, 'utf8'));
  }

  const result = await runStaticAnalysis(repo, {
    files: Array.isArray(selectedFiles) ? selectedFiles : null,
    withLlm,
    model,
  });
  const output = JSON.stringify(result, null, 2);

  if (out) {
    const outputPath = path.resolve(out);
    ensureDirectoryForFile(outputPath);
    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`Dependency graph exported: ${outputPath}`);
  } else {
    console.log(output);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  main,
};
