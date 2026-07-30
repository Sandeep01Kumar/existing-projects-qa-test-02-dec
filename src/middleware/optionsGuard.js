// Automatic-OPTIONS suppression flow, and nothing else. The framework's routing engine
// answers an OPTIONS request itself whenever the path matches a declared route: 200 with
// an Allow list and X-Content-Type-Options, written straight from the router's own
// terminator, so it never reaches the route-miss flow or the shared emitter. That is two
// headers the pre-Express server never sent, on a method this system does not serve.
// The engine exposes no switch to turn it off, so the only suppression is to terminate
// OPTIONS ahead of the routers - which is what this guard does, by handing the request to
// the same constant 404 flow every other unsupported method already takes.
const notFound = require('./notFound');

const optionsGuard = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    notFound(req, res);
    return;
  }

  next();
};

module.exports = optionsGuard;
