const express = require('express');

const helloRoutes = require('./routes/hello.routes');
const goodEveningRoutes = require('./routes/goodEvening.routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.set('etag', false);

  app.use(helloRoutes);
  app.use(goodEveningRoutes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
};

module.exports = createApp;
