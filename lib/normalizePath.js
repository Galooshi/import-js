import escapeRegExp from 'lodash.escaperegexp';


export default function normalizePath(rawPath: string, workingDirectory): string {
  if (!rawPath) {
    return './';
  }
  const workingDirPattern = RegExp(`^${escapeRegExp(workingDirectory)}`);
  const normalized = rawPath.replace(workingDirPattern, '.');
  if (normalized.startsWith('.')) {
    return normalized;
  }
  return `./${normalized}`;
}
