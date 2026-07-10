/**
 * Winston logger factory for services created from this template.
 *
 * Purpose:
 *   Builds one shared structured logger with consistent timestamp, error stack,
 *   hostname, and console transport behavior for local and container runtime.
 *
 * Environment:
 *   LOG_LEVEL controls the minimum severity, LOG_PRETTY=on enables pretty
 *   printing for local readability, and HOSTNAME is recorded as default log
 *   metadata when Docker supplies it.
 *
 * Side Effects:
 *   Creates a Winston logger instance configured to write to stdout.
 */

import winston from 'winston';

/**
 * Ordered Winston format chain used by the shared logger.
 *
 * @type {import('winston').Logform.Format[]}
 */
const log_format = [
  winston.format.errors({ stack: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
];

/**
 * Allow local developers to opt into human-readable logs without changing the
 * production JSON log shape.
 */
if (process.env.LOG_PRETTY === 'on') {
  log_format.push(winston.format.prettyPrint());
}

/**
 * Shared logger export used by the Express entry point and reusable modules.
 *
 * @type {import('winston').Logger}
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(...log_format),
  defaultMeta: { hostname: process.env.HOSTNAME || 'localhost' },
  transports: [new winston.transports.Console()]
});

export default logger;
