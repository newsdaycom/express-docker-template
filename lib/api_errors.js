/**
 * Error handling for requests
 * @param {object}  err - Error caught from failed request
 * @param {object}  req - Request from client
 * @param {object}  res - Response that will be sent to client
 * @param {object}  next - Override the next() function, next() function causes next middleware to be executed
 * @property {string} err.status - HTTP status code
 * @property {string} err.statusCode - alias for status
 * @property {string} err.name - Error type corresponding to status code
 * @property {string} err.message - Message included with error (second param of createError function call)
 * [Express.js docs for more info]{@link https://expressjs.com/en/guide/error-handling.html}
*/

export default function api_errors (err, req, res, next) {
  console.log('Routed to error handler', err);
  res.status(err.statusCode || 500).json({ success: false, error: err });
}
