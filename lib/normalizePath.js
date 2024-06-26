//

export default function normalizePath(rawPath, workingDirectory) {
  if (!rawPath) {
    return './';
  }

  if (rawPath.startsWith(workingDirectory)) {
    return `.${rawPath.slice(workingDirectory.length)}`;
  }

  if (rawPath.startsWith('/')) {
    return `.${rawPath}`;
  }

  if (
    rawPath === '.' ||
    rawPath.startsWith('./') ||
    rawPath.startsWith('../')
  ) {
    return rawPath;
  }

  return `./${rawPath}`;
}
