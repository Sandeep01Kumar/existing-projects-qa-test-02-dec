const { sendText } = require('../lib/textResponse');

const INTERNAL_ERROR_BODY = 'Internal Server Error\n';

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  sendText(res, 500, INTERNAL_ERROR_BODY);
};

module.exports = errorHandler;
