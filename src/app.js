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
// Both settings switch off framework defaults the baseline server never sent, so the
// header block stays identical. x-powered-by would advertise the framework on every
// reply. etag is a parity and future-proofing setting rather than a saving on the
// current code path: the framework generates an ETag inside its response helpers, and
// every response here is written with the raw setHeader/end pair instead, so no digest
// is being computed today. Disabling it guarantees the header cannot reappear if a
// helper is ever introduced.
//
// The pipeline is exactly four flows, and the order below is load-bearing - EVERY way
// of getting it wrong is silent, because the application still starts and still
// answers:
//   1-2. the two feature routers, root path first, then the second endpoint. Each one
//        also declines OPTIONS for its own path, because the routing engine otherwise
//        answers OPTIONS itself with 200, an Allow list and a nosniff header - two
//        headers the baseline never sent, on a method this system does not serve. The
//        engine offers no switch to disable that, and suppressing it per route keeps
//        each path's method contract with the feature that owns it instead of adding a
//        pipeline stage every request would have to walk through.
//   3.   the route-miss handler, mounted with no path argument so it runs only after
//        both routers decline. Mounted any earlier it swallows every request and both
//        endpoints degrade to 404. It is deliberately not a wildcard route: this
//        framework's major line demands that wildcards be named and throws at startup
//        on a bare one. Going path-less does not avoid compiling a pattern - the router
//        compiles a matcher for every layer as it is constructed - but a root path
//        mounted non-terminally takes a fast path that matches without running that
//        matcher, so the saving is per request rather than at startup.
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
// The factory takes no arguments, and that is deliberate too: the pipeline shape is
// fixed, so production composition carries no seam for injecting extra handlers. The
// failure contract - any unhandled error, a synchronous throw and a rejected promise
// alike, answers 500 in plain text rather than the framework's HTML page - is only
// observable when a failing flow sits AHEAD of the terminal pair, so the test suite
// builds its own local fixture around the REAL terminal handlers rather than widening
// this module's public contract to reach that position.
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
