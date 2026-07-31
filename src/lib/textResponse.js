// Sole response emitter: every reply exits here, which is what keeps
// Content-Type exact. Raw Node response API only - framework helpers rewrite it.
const { MEDIA_TYPE } = require('../config');

// Node assigns res.req for every response its HTTP server creates, and so does the
// framework, so the emitter can tell a body-bearing reply from a bodiless one without
// being handed the request. The guard on `undefined` keeps the helper safe for a caller
// that passes a bare response-like object.
const isHeadRequest = (res) => res.req !== undefined && res.req.method === 'HEAD';

// The three statements below are relocated rather than rewritten from the pre-Express
// handler, which is what makes byte-exact parity provable instead of aspirational.
//
// Content-Type is the only header this function sets unconditionally. Content-Length is
// derived by Node from the bytes it actually sends, so a body-bearing reply gets the
// right value for free - 14 on /, 13 on /good-evening, 10 on a route miss, 22 on a
// failure - appended after Keep-Alive, which is the header order the pre-Express server
// produced. A HEAD reply sends no body, so Node has nothing to measure and would emit no
// Content-Length at all; the contract still requires the length of the representation the
// resource WOULD have returned, so it is set explicitly for HEAD and only for HEAD.
//
// Doing it on that one branch is what keeps a GET response untouched: its header block,
// values and ordering are exactly what the baseline emitted. On HEAD the length is
// measured from the same constant the matching GET would have sent, so the two methods
// report identical representation metadata - which is what a HEAD request is for.
const sendText = (res, statusCode, body) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', MEDIA_TYPE);

  if (isHeadRequest(res)) {
    res.setHeader('Content-Length', Buffer.byteLength(body));
  }

  res.end(body);
};

module.exports = { sendText };
