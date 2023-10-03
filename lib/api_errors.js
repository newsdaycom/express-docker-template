/**
 * Error handling for requests
 *
 * err.status - HTTP status code
 *
 * err.statusCode - alias for status
 *
 * err.name - Error type corresponding to status code
 *
 * err.message - Message included with error (second param of createError function call)
 * types below are ExpressJS-specific types (besides Error)
 * @param {Error & HttpError} err Error caught from failed request
 * @param {Request} req Request from client
 * @param {Response} res Response that will be sent to client
 * @param {NextFunction} next Override the next() function, next() function causes next middleware to be executed
 *
 * [Express.js docs for more info](https://expressjs.com/en/guide/error-handling.html)
*/

export default function api_errors (err, req, res, next) {
  console.log('Routed to error handler', err);
  res.status(err.statusCode || 500).json({ success: false, error: err });
}
