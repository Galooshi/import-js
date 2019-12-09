import winston from 'winston';

winston.configure({
  level: 'error',
  transports: [new winston.transports.Console()],
});
