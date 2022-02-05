import express from 'express';
var router = express.Router();

/* GET users listing. */
router.get('/', function (req, res, next) {
  res.json({
    success: true,
    message: 'API Up!',
  });
});

export default router;
