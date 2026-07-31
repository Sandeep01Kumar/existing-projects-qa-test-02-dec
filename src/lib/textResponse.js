// Sole response emitter: every reply exits here, which is what keeps
// Content-Type exact. Raw Node response API only - framework helpers rewrite it.
const { MEDIA_TYPE } = require('../config');

// Three statements, relocated rather than rewritten from the pre-Express handler, which
// is what makes byte-exact parity provable instead of aspirational. Content-Type is the
// ONLY header set here: Node derives Content-Length from the body it actually sends, so a
// GET reply gets it for free and a HEAD reply - which sends no body - correctly carries
// none, exactly as the baseline server behaved.
const sendText = (res, statusCode, body) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', MEDIA_TYPE);
  res.end(body);
};

module.exports = { sendText };
