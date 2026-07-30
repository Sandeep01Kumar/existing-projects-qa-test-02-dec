// Composition flow: the one place where the application pipeline is assembled.
// This module is what the baseline server's single catch-all callback became - that
// callback was split into two feature routers and two terminal handlers, and joining
// them in the right order is this file's only reason to change.
//
// The factory hands back an UNBOUND application: it opens no socket and picks no
// address. The root entry point owns that decision and passes the loopback host
// explicitly, which is what keeps the socket off every other interface. Staying
// unbound is also what lets the test suites drive this pipeline in-process on an
// ephemeral port rather than needing the project's default port to be free.
const express = require('express');

const helloRoutes = require('./routes/hello.routes');
const goodEveningRoutes = require('./routes/goodEvening.routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

// Builds and configures a new application on every call - deliberately not memoised,
// because the bootstrap and each test file each own an independent instance.
//
// The two settings switch off framework defaults the baseline server never sent, so
// the header block stays identical: x-powered-by would advertise the framework on
// every reply, and etag would cost a hash over each body, making its removal a small
// performance win as well as a parity one.
//
// The mount order below is load-bearing, and BOTH ways of getting it wrong are
// silent - the application still starts and still answers:
//   1-2. the two feature routers, root path first, then the second endpoint.
//   3.   the route-miss handler, mounted with no path argument so it runs only after
//        both routers decline. Mounted any earlier it swallows every request and both
//        endpoints degrade to 404. It is deliberately not a wildcard route: this
//        framework's major line demands that wildcards be named and throws at startup
//        on a bare one, and a path-less handler is cheaper anyway because no pattern
//        has to be compiled.
//   4.   the error sink, which must stay last. The framework spots an error handler
//        by its four-parameter arity and only honours the final one as terminal;
//        anywhere else a failure escapes to the built-in HTML error page this system
//        has never emitted. It also absorbs promise rejections, which this major line
//        forwards automatically.
//
// Nothing else is mounted, and that ceiling is deliberate: no body parser, so a
// request payload is never buffered or decoded; no payload-shrinking layer, no
// request logger, no security-header bundle, no static asset handler, no proxy trust.
// Each was weighed and declined, which holds the direct dependency count at exactly
// one and per-request work at four handler frames.
//
// @returns {Function} the configured application, ready for a caller to bind
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
