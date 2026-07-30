const express = require('express');

const { sendText } = require('../lib/textResponse');

const HELLO_BODY = 'Hello, World!\n';

const router = express.Router();

router.get('/', (req, res) => {
  sendText(res, 200, HELLO_BODY);
});

module.exports = router;
