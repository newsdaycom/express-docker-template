import express from 'express';

const router = express.Router();

/* GET users listing. */
router.get('/', (req, res, next) => {
  res.json({
    success: true,
    message: 'API Up!'
  });
});

export default router;
