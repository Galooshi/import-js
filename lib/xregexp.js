const xRegExp = require('xregexp');

module.exports = (regexp, flags) => {
  const lines = regexp.split('\n');
  return xRegExp(
    lines.map((line) => line.replace(/\s+#.+/, ' ')).join('\n'),
    flags
  );
};
