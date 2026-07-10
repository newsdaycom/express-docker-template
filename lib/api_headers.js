/**
 * API response-header middleware shared by template services.
 *
 * Purpose:
 *   Adds JSON content, cache, build-version, and optional Newsday-origin CORS
 *   headers before an API route writes its response.
 *
 * Environment:
 *   ENV=local disables API response caching for local development.
 *   BUILD_VERSION is exposed through `x-build-version` for deployment tracing.
 *
 * Side Effects:
 *   Mutates the Express response headers and then passes control to the next
 *   middleware.
 *
 * @param {import('express').Request} req Request object from the client.
 * @param {import('express').Response} res Response object to mutate.
 * @param {import('express').NextFunction} next Express continuation callback.
 * @returns {void}
 */
export default function api_headers(req, res, next) {
  let origin = [req.headers.origin].find(o => o);

  /**
   * Restrict template CORS support to Newsday origins so generated services do
   * not accidentally ship with a public wildcard origin.
   */
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

  Object.keys(response_headers).forEach(h => {
    res.header(h, response_headers[h]);
  });

  next();
}
