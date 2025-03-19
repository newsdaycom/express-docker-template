// entry file

import express from 'express';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import apiRouter from './routes/api';
import api_headers from './lib/api_headers';
import api_errors from './lib/api_errors';
import logger from './lib/logger';

const app = express();

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/api', api_headers, apiRouter, api_errors);

app.get('/', (req, res, next) => {
  res.send('<h1>Microservice is running</h1>');
});

app.listen(3000, () => {
  logger.info('Service running on port 3000');
});

export default app;
