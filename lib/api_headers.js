/**
 * Updates response headers by merging the defaults with any addons or overrides from the responding method
 *
 * This method conditionally enabled CORS by analyzing components of the request headers. It also takes a standard object
 * of headers and will append new ones to the response. Existing header values provided by the responding method will override
 * the values provided by the base object.
 *
 * These changes are made directly to the provided res object so nothing is returned by this method
 *
 * @param {Object} req Request object
 * @param {Object} res Response object
 * @param {Object} headers Standard object of header values in key: pair form
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
    'X-ACE-Feeds-Version': '20220115a',
    ...cors_headers,
    ...custom_headers
  };

  Object.keys(response_headers).forEach((h) => {
    res.header(h, response_headers[h]);
  });

  next();
}
