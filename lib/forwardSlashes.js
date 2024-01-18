// @flow
export default function forwardSlashes(path: string): string {
  return path.replace(/(^[A-Z]:\\|\\)/g, '/');
}
