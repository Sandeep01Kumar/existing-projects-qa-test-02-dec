// Sole response emitter: every reply exits here, which is what keeps
// Content-Type exact. Raw Node response API only - framework helpers rewrite it.
const { MEDIA_TYPE } = require('../config');

// Node assigns res.req for every response its HTTP server creates, and so does the
// framework, so the emitter can tell a body-bearing reply from a bodiless one.
const isHeadRequest = (res) => res.req !== undefined && res.req.method === 'HEAD';

const sendText = (res, statusCode, body) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', MEDIA_TYPE);

  // A HEAD reply sends no body, so Node has nothing to measure and omits
  // Content-Length; the contract still requires the representation length of the
  // resource (14 on /, 13 on /good-evening). Set it for HEAD only - on a
  // body-bearing reply Node appends the identical value itself, after Keep-Alive,
  // which is the header order the pre-Express server produced.
  if (isHeadRequest(res)) {
    res.setHeader('Content-Length', Buffer.byteLength(body));
  }

  res.end(body);
};

module.exports = { sendText };
