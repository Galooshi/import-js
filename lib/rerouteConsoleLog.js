import winston from 'winston';

/**
 * Reroutes console logs to winston
 */
export default function rerouteConsoleLog() {
  console.trace = winston.trace;
  console.debug = winston.debug;
  console.info = winston.info;
  console.warn = winston.warn;
  console.error = winston.error;
}
