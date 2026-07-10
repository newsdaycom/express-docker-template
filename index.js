/**
 * Express application entry point for services created from this template.
 *
 * Purpose:
 *   Wires shared middleware, mounts the starter API router, exposes a basic root
 *   readiness page, and starts the HTTP listener used by Docker and local
 *   development.
 *
 * Environment:
 *   Reads logging and response-header settings indirectly through the imported
 *   middleware modules. The server listens on port 3000 inside the container.
 *
 * Side Effects:
 *   Starts a Node HTTP server when this module is evaluated.
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import apiRouter from './routes/api';
import api_headers from './lib/api_headers';
import api_errors from './lib/api_errors';
import logger from './lib/logger';

const app = express();

/**
 * Register request parsing, access logging, cookie parsing, API headers, routes,
 * and API error handling in the order Express should execute them.
 */
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/api', api_headers, apiRouter, api_errors);

/**
 * Render the template service's root readiness response.
 *
 * @param {import('express').Request} req Incoming browser or probe request.
 * @param {import('express').Response} res Response used to send HTML.
 * @param {import('express').NextFunction} next Express continuation callback.
 * @returns {void}
 */
app.get('/', (req, res, next) => {
  res.send('<h1>Microservice is running</h1>');
});

/**
 * Start the local/container HTTP listener.
 *
 * @returns {void}
 * @sideEffects Binds port 3000 and writes a structured startup log message.
 */
app.listen(3000, () => {
  logger.info('Service running on port 3000');
});

export default app;
