// Use setHeader/end so Express send helpers cannot append a charset.
const { MEDIA_TYPE } = require('../config');

// Node assigns res.req for every response its HTTP server creates, and so does the
// framework, so the emitter can tell a body-bearing reply from a bodiless one without
// being handed the request. The guard on `undefined` keeps the helper safe for a caller
// that passes a bare response-like object.
const isHeadRequest = (res) => res.req !== undefined && res.req.method === 'HEAD';

// Leave body-bearing Content-Length to Node so GET header ordering remains unchanged.
const sendText = (res, statusCode, body) => {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', MEDIA_TYPE);

  if (isHeadRequest(res)) {
    res.setHeader('Content-Length', Buffer.byteLength(body));
  }

  res.end(body);
};

module.exports = { sendText };
