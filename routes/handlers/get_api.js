/**
 * Return the starter API health response.
 *
 * @param {import('express').Request} req Incoming request.
 * @param {import('express').Response} res Express response.
 * @returns {void}
 */
export default function getApi(req, res) {
  res.json({ success: true, message: 'API Up!' });
}
