const assert = require('assert');
const { Parser, Language } = require('web-tree-sitter');

let passed = 0;
let failed = 0;
let isParserInitialized = false;

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

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  PASS  ' + name);
  } catch (err) {
    failed++;
    console.error('  FAIL  ' + name);
    console.error('        ' + err.message);
  }
}

async function initializeTestParser() {
  if (isParserInitialized) return;
  const wasmPath = require.resolve('web-tree-sitter/tree-sitter.wasm');
  await Parser.init({
    locateFile(scriptName) {
      if (scriptName === 'tree-sitter.wasm') return wasmPath;
      return scriptName;
    },
  });
  isParserInitialized = true;
}

async function loadAndParse(grammarName, sourceCode) {
  await initializeTestParser();
  const wasmPath = require.resolve('tree-sitter-wasms/out/' + grammarName + '.wasm');
  const language = await Language.load(wasmPath);
  const parser = new Parser();
  parser.setLanguage(language);
  return parser.parse(sourceCode);
}

async function runTests() {
  console.log('\n=== Tree-sitter Parser Loading Tests ===\n');

  await testAsync('Parse JavaScript', async function () {
    const tree = await loadAndParse('tree-sitter-javascript',
      'const x = 1;\nfunction hello() { return "world"; }\n');
    assert(tree.rootNode);
    assert(tree.rootNode.type === 'program');
  });

  await testAsync('Parse TypeScript', async function () {
    const tree = await loadAndParse('tree-sitter-typescript',
      'const x: number = 1;\nfunction greet(name: string): void { console.log(name); }\n');
    assert(tree.rootNode);
    assert(tree.rootNode.type === 'program');
  });

  await testAsync('Parse TSX', async function () {
    const tree = await loadAndParse('tree-sitter-tsx',
      'import React from "react";\nconst App = () => <div>Hello</div>;\n');
    assert(tree.rootNode);
    assert(tree.rootNode.type === 'program');
  });

  await testAsync('Parse Python', async function () {
    const tree = await loadAndParse('tree-sitter-python',
      'import os\ndef hello():\n    return "world"\n');
    assert(tree.rootNode);
    assert(tree.rootNode.type === 'module');
  });

  await testAsync('Parse Java', async function () {
    const tree = await loadAndParse('tree-sitter-java',
      'import java.util.List;\npublic class Main { public static void main(String[] args) {} }\n');
    assert(tree.rootNode);
    assert(tree.rootNode.type === 'program');
  });

  await testAsync('Parse C', async function () {
    const tree = await loadAndParse('tree-sitter-c',
      '#include <stdio.h>\nint main() { printf("hello"); return 0; }\n');
    assert(tree.rootNode);
    assert(tree.rootNode.type === 'translation_unit');
  });

  await testAsync('Parse C++', async function () {
    const tree = await loadAndParse('tree-sitter-cpp',
      '#include <iostream>\nint main() { std::cout << "hello"; return 0; }\n');
    assert(tree.rootNode);
    assert(tree.rootNode.type === 'translation_unit');
  });

  await testAsync('Parse Go', async function () {
    const tree = await loadAndParse('tree-sitter-go',
      'package main\nimport "fmt"\nfunc main() { fmt.Println("hello") }\n');
    assert(tree.rootNode);
    assert(tree.rootNode.type === 'source_file');
  });

  await testAsync('Parse Rust', async function () {
    const tree = await loadAndParse('tree-sitter-rust',
      'use std::io;\nfn main() { println!("hello"); }\n');
    assert(tree.rootNode);
    assert(tree.rootNode.type === 'source_file');
  });

  await testAsync('Parse PHP', async function () {
    const tree = await loadAndParse('tree-sitter-php',
      '<?php\nfunction hello() { return "world"; }\n');
    assert(tree.rootNode);
  });

  await testAsync('Parse Ruby', async function () {
    const tree = await loadAndParse('tree-sitter-ruby',
      'require "json"\ndef hello\n  puts "world"\nend\n');
    assert(tree.rootNode);
    assert(tree.rootNode.type === 'program');
  });

  await testAsync('Parse C#', async function () {
    const tree = await loadAndParse('tree-sitter-c_sharp',
      'using System;\nclass Program { static void Main() {} }\n');
    assert(tree.rootNode);
    assert(tree.rootNode.type === 'compilation_unit');
  });

  await testAsync('Parse Kotlin', async function () {
    const tree = await loadAndParse('tree-sitter-kotlin',
      'fun main() { println("hello") }\n');
    assert(tree.rootNode);
  });

  await testAsync('Parse Swift', async function () {
    const tree = await loadAndParse('tree-sitter-swift',
      'import Foundation\nfunc hello() -> String { return "world" }\n');
    assert(tree.rootNode);
  });

  await testAsync('Parse HTML', async function () {
    const tree = await loadAndParse('tree-sitter-html',
      '<!DOCTYPE html>\n<html><head><title>T</title></head><body><p>Hi</p></body></html>\n');
    assert(tree.rootNode);
    assert(tree.rootNode.type === 'document');
  });

  await testAsync('Parse CSS', async function () {
    const tree = await loadAndParse('tree-sitter-css',
      '@import url("reset.css");\nbody { color: red; }\n');
    assert(tree.rootNode);
    assert(tree.rootNode.type === 'stylesheet');
  });

  await testAsync('Parse JSON', async function () {
    const tree = await loadAndParse('tree-sitter-json',
      '{"name": "test", "version": "1.0"}\n');
    assert(tree.rootNode);
    assert(tree.rootNode.type === 'document');
  });

  await testAsync('Parse Bash', async function () {
    const tree = await loadAndParse('tree-sitter-bash',
      '#!/bin/bash\necho "hello"\nfunction greet() { echo "hi"; }\n');
    assert(tree.rootNode);
    assert(tree.rootNode.type === 'program');
  });

  await testAsync('Parse Lua', async function () {
    const tree = await loadAndParse('tree-sitter-lua',
      'require("math")\nfunction hello() print("world") end\n');
    assert(tree.rootNode);
    assert(tree.rootNode.type === 'chunk');
  });

  await testAsync('Parse Elixir', async function () {
    const tree = await loadAndParse('tree-sitter-elixir',
      'defmodule Hello do\n  def world do\n    "hello"\n  end\nend\n');
    assert(tree.rootNode);
  });

  await testAsync('Parse Scala', async function () {
    const tree = await loadAndParse('tree-sitter-scala',
      'object Hello {\n  def main(args: Array[String]): Unit = {\n    println("hello")\n  }\n}\n');
    assert(tree.rootNode);
    assert(tree.rootNode.type === 'compilation_unit');
  });

  console.log('\n=== Summary ===\n');
  console.log('  ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(function (err) {
  console.error(err);
  process.exit(1);
});
