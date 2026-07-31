const express = require('express');
const { sendText } = require('../lib/textResponse');

const HELLO_BODY = 'Hello, World!\n';

// Use exact matching so undeclared case/trailing-slash aliases fall through to 404.
const router = express.Router({ caseSensitive: true, strict: true });

// Decline OPTIONS so Express does not auto-reply; let notFound emit the plain-text 404.
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
