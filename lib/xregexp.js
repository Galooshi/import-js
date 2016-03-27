const xRegExp = require('xregexp');

/**
 * Wrapper for xRegExp to work around
 * https://github.com/slevithan/xregexp/issues/130
 */
module.exports = (regexp, flags) => {
  if (!flags || !flags.includes('x')) {
    // We aren't using the 'x' flag, so we don't need to remove comments and
    // whitespace as a workaround for
    // https://github.com/slevithan/xregexp/issues/130
    return xRegExp(regexp, flags);
  }

  const lines = regexp.split('\n');
  return xRegExp(
    lines.map((line) => line.replace(/\s+#.+/, ' ')).join('\n'),
    flags
  );
};
