const { sendText } = require('../lib/textResponse');

const NOT_FOUND_BODY = 'Not Found\n';

const notFound = (req, res) => {
  sendText(res, 404, NOT_FOUND_BODY);
};

module.exports = notFound;
