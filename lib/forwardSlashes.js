//
export default function forwardSlashes(path) {
  return path.replace(/(^[A-Z]:\\|\\)/g, '/');
}
