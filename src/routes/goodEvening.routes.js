// The good-evening feature flow and nothing else (F-007). The body is a module-scope
// constant so no string is allocated per request, and the write is delegated to the
// shared emitter - a framework reply helper would append an encoding parameter to
// the media type and silently break the byte-exact contract.
const express = require('express');

const { sendText } = require('../lib/textResponse');

const GOOD_EVENING_BODY = 'Good evening\n';

const router = express.Router();

router.get('/good-evening', (req, res) => {
  sendText(res, 200, GOOD_EVENING_BODY);
});

module.exports = router;
