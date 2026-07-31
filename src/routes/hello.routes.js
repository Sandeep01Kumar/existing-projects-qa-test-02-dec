const express = require('express');
const { sendText } = require('../lib/textResponse');

const HELLO_BODY = 'Hello, World!\n';

// Exact-path matching, both options load-bearing. Left at their defaults the router treats
// case as insignificant and a trailing slash as optional, so `//` would ALSO serve this
// resource - an alias the contract never declared and no test covered. The declared surface is
// exactly two paths and everything else is the plain-text 404, so the matcher is told to agree:
// `strict` makes a trailing slash significant and `caseSensitive` makes case significant. Both
// are settings on the compiled matcher, so they cost nothing per request.
const router = express.Router({ caseSensitive: true, strict: true });

// Declining OPTIONS is load-bearing, not dead code. router@2.2.0 answers OPTIONS
// itself whenever a matched route has no OPTIONS handler: it collects the route's
// methods and emits 200 with Allow and X-Content-Type-Options: nosniff - two
// headers the baseline server never sent, and a status this path must not return.
// Registering an OPTIONS handler on the same route suppresses that reply at source
// (the router then has nothing to advertise), and next() hands the request to the
// single route-miss flow, so OPTIONS gets the same plain-text 404 as POST.
const declineOptions = (req, res, next) => {
  next();
};

router
  .route('/')
  .get((req, res) => {
    sendText(res, 200, HELLO_BODY);
  })
  .options(declineOptions);

module.exports = router;
