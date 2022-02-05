import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import apiRouter from './routes/api.js';
import api_headers from './lib/api_headers.js';
import api_errors from './lib/api_errors.js';

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/api', api_headers, apiRouter, api_errors);

app.listen(3000, function () {
  console.log('Service running on port 3000');
});

/** Nodemon respect */
process.once('SIGUSR2', function () {
  process.kill(process.pid, 'SIGUSR2');
});

export default app;
