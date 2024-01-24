import visitIdentifierNodes from './visitIdentifierNodes';

const JSX_BUILT_IN_ELEMENT_PATTERN = /^[a-z]/;

export default function findUndefinedIdentifiers(ast, globalVariables = []) {
  const result = [];
  visitIdentifierNodes(
    ast.program,
    ({ isReference, isJSX, name, context }) => {
      if (isReference) {
        return;
      }
      if (isJSX && JSX_BUILT_IN_ELEMENT_PATTERN.test(name)) {
        return;
      }
      result.push({ name, context });
    },
    {
      definedInScope: new Set(globalVariables),
    },
  );

  // Filter out those that are defined in the current scope
  const filtered = new Set();
  result.forEach(({ name, context }) => {
    if (context.definedInScope.has(name)) {
      return;
    }
    filtered.add(name);
  });
  return filtered;
}
