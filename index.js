import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import apiRouter from './routes/api';
import api_headers from './lib/api_headers';
import api_errors from './lib/api_errors';

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/api', api_headers, apiRouter, api_errors);

app.listen(3000, () => {
  console.info('Service running on port 3000');
});

export default app;
