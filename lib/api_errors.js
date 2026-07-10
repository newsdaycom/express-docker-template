/**
 * Express API error-handling middleware for template services.
 *
 * Purpose:
 *   Converts route and middleware errors into the JSON envelope expected by the
 *   starter API surface.
 *
 * Inputs:
 *   `err.status` and `err.statusCode` may contain the HTTP status produced by
 *   `http-errors` or another middleware. `err.name` and `err.message` identify
 *   the error type and message.
 *
 * Side Effects:
 *   Logs the routed error to stdout and writes a JSON error response.
 *
 * @param {Error & {status?: number, statusCode?: number}} err Error caught from a failed request.
 * @param {import('express').Request} req Request from the client.
 * @param {import('express').Response} res Response that will be sent to the client.
 * @param {import('express').NextFunction} next Express continuation callback.
 * @returns {void}
 * @see https://expressjs.com/en/guide/error-handling.html
 */
export default function api_errors(err, req, res, next) {
  // eslint-disable-next-line no-console
  console.log('Routed to error handler', err);
  res.status(err.statusCode || 500).json({ success: false, error: err });
}
