import escapeRegExp from 'lodash.escaperegexp';

export default function normalizePath(rawPath: string): string {
  if (!rawPath) {
    return './';
  }
  const normalized = rawPath.replace(RegExp(`^${escapeRegExp(process.cwd())}`), '.');
  if (normalized.startsWith('.')) {
    return normalized;
  }
  return `./${normalized}`;
}
