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

const optionsGuard = require('./middleware/optionsGuard');
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
// The mount order below is load-bearing, and EVERY way of getting it wrong is
// silent - the application still starts and still answers:
//   1.   the OPTIONS guard, which must run BEFORE the routers. The routing engine
//        answers an OPTIONS request itself as soon as the path matches a declared
//        route, replying 200 from its own terminator with an Allow list and a nosniff
//        header - two headers the baseline never sent, on a method this system does
//        not serve, on a path that never reaches the emitter. The engine offers no
//        switch to disable that, so getting in front of it is the only suppression.
//   2-3. the two feature routers, root path first, then the second endpoint.
//   4.   any additional flows the caller supplied - none in the running server, and
//        positioned here rather than anywhere else because this is the only slot that
//        is both after every declared route and before the terminal pair.
//   5.   the route-miss handler, mounted with no path argument so it runs only after
//        both routers decline. Mounted any earlier it swallows every request and both
//        endpoints degrade to 404. It is deliberately not a wildcard route: this
//        framework's major line demands that wildcards be named and throws at startup
//        on a bare one, and a path-less handler is cheaper anyway because no pattern
//        has to be compiled.
//   6.   the error sink, which must stay last. The framework spots an error handler
//        by its four-parameter arity and only honours the final one as terminal;
//        anywhere else a failure escapes to the built-in HTML error page this system
//        has never emitted. It also absorbs promise rejections, which this major line
//        forwards automatically.
//
// Nothing else is mounted by default, and that ceiling is deliberate: no body parser,
// so a request payload is never buffered or decoded; no payload-shrinking layer, no
// request logger, no security-header bundle, no static asset handler, no proxy trust.
// Each was weighed and declined, which holds the direct dependency count at exactly
// one and per-request work at five handler frames.
//
// The one seam in that ceiling is the additionalFlows parameter, and it exists because
// the position it fills cannot be reached from outside this module. Mounting always
// APPENDS, so a caller holding a composed application can only add handlers behind the
// route-miss flow, where nothing ever reaches them. The failure contract - any
// unhandled error, a synchronous throw and a rejected promise alike, answers 500 in
// plain text rather than the framework's HTML page - is only observable when a flow
// that fails sits AHEAD of the terminal pair. Pipeline shape is this module's single
// responsibility, so the seam belongs here rather than in a second composition root
// that would have to restate the mount order and could drift from it.
//
// It costs the running server nothing: the bootstrap calls the factory with no
// argument, the default is empty, and an empty iteration mounts nothing, so the
// composed pipeline and its five handler frames are identical to what they were before
// the parameter existed.
//
// @param {Function[]} [additionalFlows] middleware to mount after both feature routers
//   and before the two terminal handlers. Defaults to none.
// @returns {Function} the configured application, ready for a caller to bind
// @throws {TypeError} if additionalFlows is not an array of functions
const createApp = (additionalFlows = []) => {
  // Validated in full before anything is mounted, so a bad argument cannot leave a
  // half-composed application behind, and the failure names the parameter rather than
  // surfacing as the framework's generic middleware complaint.
  const everyFlowIsMiddleware =
    Array.isArray(additionalFlows) &&
    additionalFlows.every((flow) => typeof flow === 'function');

  if (!everyFlowIsMiddleware) {
    throw new TypeError('additionalFlows must be an array of middleware functions');
  }

  const app = express();

  app.disable('x-powered-by');
  app.set('etag', false);

  app.use(optionsGuard);
  app.use(helloRoutes);
  app.use(goodEveningRoutes);
  additionalFlows.forEach((flow) => app.use(flow));
  app.use(notFound);
  app.use(errorHandler);

  return app;
};

module.exports = createApp;
