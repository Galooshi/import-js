export default {
  pathToCanonical(path: string): string {
    return path.replace(/(^[A-Z]:\\|\\)/g, '/');
  },
};
