const regExpEscape = (s) =>
  s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

module.exports = regExpEscape;

