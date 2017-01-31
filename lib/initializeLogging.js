import winston from 'winston';

import Configuration from './Configuration';
import rerouteConsoleLog from './rerouteConsoleLog';

function initializeLogging(pathToLogFile) {
  // The `importjs` here is mostly a dummy file because config relies on a
  // `pathToCurrentFile`. Normally, this is the javascript file you are
  // editing.
  const level = new Configuration('importjs').get('logLevel');
  winston.configure({
    level,
    transports: [
      new winston.transports.File({
        filename: pathToLogFile,

        json: false,

        timestamp() {
          return Date.now();
        },

        formatter({ timestamp, level, message }) {
          const parts = [timestamp(), level.toUpperCase()];
          if (initializeLogging.parentPid) {
            // This gets set when run as a daemon
            parts.push(`PID:${initializeLogging.parentPid}`);
          }
          parts.push(message);
          return parts.join(' ');
        },
      }),
    ],
  });
  rerouteConsoleLog();
}

export default initializeLogging;
