import visitIdentifierNodes from './visitIdentifierNodes';

export default function findUndefinedIdentifiers(ast, globalVariables = []) {
  const result = new Set();
  visitIdentifierNodes(
    ast.program,
    ({ isReference, isJSX, name, definedInScope }) => {
      if (isJSX && !definedInScope.has('React')) {
        result.add('React'); // Implicit dependency
      }
      if (isReference) {
        return;
      }
      if (definedInScope.has(name)) {
        return;
      }
      if (isJSX && /^[a-z]/.test(name)) {
        return;
      }
      result.add(name);
    },
    {
      definedInScope: new Set(globalVariables),
    },
  );
  return result;
}
