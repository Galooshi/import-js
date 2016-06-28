import fs from 'fs';
import util from 'util';

/**
 * Reroutes console logs to a file. Returns the original `console.log`.
 */
export default function rerouteConsoleLog(pathToLogFile: string): Function {
  const logStream = fs.createWriteStream(pathToLogFile, {
    flags: 'w',
  });

  /* eslint-disable no-console */
  const originalConsoleLog = console.log;
  console.log = (...args) => {
    logStream.write(`${util.format.apply(null, args)}\n`);
  };
  console.trace = console.log;
  console.debug = console.log;
  console.info = console.log;
  console.warn = console.log;
  console.error = console.log;
  /* eslint-enable no-console */
  return originalConsoleLog;
}
