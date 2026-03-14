function getNodeText(node, source) {
  return source.slice(node.startIndex, node.endIndex);
}

function walkTree(node, visit, context = {}) {
  if (!node) {
    return;
  }

  const nextContext = visit(node, context) ?? context;

  for (const child of node.namedChildren) {
    walkTree(child, visit, nextContext);
  }
}

module.exports = {
  getNodeText,
  walkTree,
};
