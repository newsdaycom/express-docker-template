/**
 * Render the template service root response.
 *
 * @param {import('express').Request} req Incoming request.
 * @param {import('express').Response} res Express response.
 * @returns {void}
 */
export default function getRoot(req, res) {
  res.send('<h1>Microservice is running</h1>');
}
