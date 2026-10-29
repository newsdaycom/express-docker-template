/**
 * Starter API router for services created from this template.
 *
 * Purpose:
 *   Provides a minimal `/api` health-style JSON response that generated
 *   services can replace with their real HTTP contract.
 *
 * Side Effects:
 *   Creates an Express router instance and exports it for mounting by
 *   `index.js`.
 */

import express from 'express';
import getApi from './handlers/get_api';

const router = express.Router();

/**
 * Return the default API availability response.
 *
 * @param {import('express').Request} req Incoming API request.
 * @param {import('express').Response} res Response used to send JSON.
 * @param {import('express').NextFunction} next Express continuation callback.
 * @returns {void}
 */
router.get('/', getApi);

export default router;
