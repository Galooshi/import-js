import escapeRegExp from 'lodash.escaperegexp';

const CWD_PATTERN = RegExp(`^${escapeRegExp(process.cwd())}`);

export default function normalizePath(rawPath: string): string {
  if (!rawPath) {
    return './';
  }
  const normalized = rawPath.replace(CWD_PATTERN, '.');
  if (normalized.startsWith('.')) {
    return normalized;
  }
  return `./${normalized}`;
}
