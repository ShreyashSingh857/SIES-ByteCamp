const path = require('path');

function toProjectRelativePath(repositoryPath, absoluteFilePath) {
  return path.relative(repositoryPath, absoluteFilePath).split(path.sep).join('/');
}

module.exports = {
  toProjectRelativePath,
};
