// Return an unbound app so server.js owns the loopback bind and tests can use ephemeral ports.
const express = require('express');

const helloRoutes = require('./routes/hello.routes');
const goodEveningRoutes = require('./routes/goodEvening.routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const createApp = () => {
  const app = express();

  // Suppress two framework defaults the baseline never sent: x-powered-by advertises the
  // framework, and etag would reappear the moment a response helper replaced the raw
  // setHeader/end pair.
  app.disable('x-powered-by');
  app.set('etag', false);

  // Mount order is contractual, and every way of getting it wrong is silent. The feature
  // routers claim their own paths first; notFound is path-less, so mounted any earlier it
  // would answer every request; errorHandler is identified as error middleware by its
  // four-argument arity and must follow every flow whose errors it has to receive.
  app.use(helloRoutes);
  app.use(goodEveningRoutes);
  app.use(notFound);
  app.use(errorHandler);

  return app;
};

module.exports = createApp;
