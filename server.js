const createApp = require('./src/app');
const { HOSTNAME, PORT } = require('./src/config');

createApp().listen(PORT, HOSTNAME, () => {
  console.log(`Server running at http://${HOSTNAME}:${PORT}/`);
});
