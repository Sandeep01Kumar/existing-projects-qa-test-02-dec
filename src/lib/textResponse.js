// Sole response emitter: every reply exits here, which is what keeps
// Content-Type exact. Raw Node response API only - framework helpers rewrite it.
const { MEDIA_TYPE } = require('../config');

const sendText = (res, statusCode, body) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', MEDIA_TYPE);
  res.end(body);
};

module.exports = { sendText };
