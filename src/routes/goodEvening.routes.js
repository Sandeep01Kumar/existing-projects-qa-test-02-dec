const express = require('express');

const { sendText } = require('../lib/textResponse');

const GOOD_EVENING_BODY = 'Good evening\n';

const router = express.Router();

router.get('/good-evening', (req, res) => {
  sendText(res, 200, GOOD_EVENING_BODY);
});

module.exports = router;
