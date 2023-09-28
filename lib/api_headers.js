/**
 * Updates response headers by merging the defaults with any addons or overrides from the responding method
 *
 * This method conditionally enabled CORS by analyzing components of the request headers. It also takes a standard object
 * of headers and will append new ones to the response. Existing header values provided by the responding method will override
 * the values provided by the base object.
 *
 * These changes are made directly to the provided res object so nothing is returned by this method
 * types below are ExpressJS-specific types (besides Error) *
 * @param {Request} req Request object
 * @param {Response} res Response object
 * @param {NextFunction} next Override the next() function, next() function causes next middleware to be executed
 */
export default function api_headers (req, res, next) {
  let origin = [req.headers.origin].find((o) => o);

  // console.log('>>> Origin >>>', origin);
  // console.log('>>> RECEIVED HEADERS >>>', req.headers);

  if (!/newsday/i.test(origin)) {
    origin = undefined;
  }

  if (origin && !/https?:\/\//i.test(origin)) {
    origin = `https://${origin}`;
  }

  const custom_headers = {};

  if (process.env.ENV === 'local') {
    custom_headers['Cache-Control'] = 'no-cache';
  }

  const cors_headers = {};

  if (origin) {
    Object.assign(cors_headers, {
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Origin': origin
    });
  }

  const response_headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=120, s-maxage=120',
    'x-build-version': process.env.BUILD_VERSION,
    ...cors_headers,
    ...custom_headers
  };

  Object.keys(response_headers).forEach((h) => {
    res.header(h, response_headers[h]);
  });

  next();
}
