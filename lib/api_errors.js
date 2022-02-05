export default function api_errors (err, req, res, next) {
  console.log('Routed to error handler', err);
  res.status(err.code || 500).json({ success: false, error: err });
}
