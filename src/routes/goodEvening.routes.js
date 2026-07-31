const express = require('express');

const { sendText } = require('../lib/textResponse');

const GOOD_EVENING_BODY = 'Good evening\n';

const router = express.Router();

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
  .route('/good-evening')
  .get((req, res) => {
    sendText(res, 200, GOOD_EVENING_BODY);
  })
  .options(declineOptions);

module.exports = router;
