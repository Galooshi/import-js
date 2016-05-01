/**
 * Takes a string in any of the following four formats:
 *   dash-separated
 *   snake_case
 *   camelCase
 *   PascalCase
 * and turns it into a regex that you can use to find matching files.
 *
 * @param {String} string
 * @return {String}
 */
export default function formattedToRegex(string) {
  // Based on
  // http://stackoverflow.com/questions/1509915/converting-camel-case-to-underscore-case-in-ruby

  // The pattern to match in between words. The "es" and "s" match is there
  // to catch pluralized folder names. There is a risk that this is overly
  // aggressive and will lead to trouble down the line. In that case, we can
  // consider adding a configuration option to control mapping a singular
  // variable name to a plural folder name (suggested by @lencioni in #127).
  // E.g.
  //
  // {
  //   "^mock": "./mocks/"
  // }
  const splitPattern = '(es|s)?.?';

  // Split up the string, allow pluralizing and a single (any) character
  // in between. This will make e.g. 'fooBar' match 'foos/bar', 'foo_bar',
  // and 'foobar'.
  return string
    .replace(/([a-z\d])([A-Z])/g, `$1${splitPattern}$2`) // camelCase
    .replace(/[-_]/g, splitPattern)
    .toLowerCase();
}
