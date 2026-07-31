const createApp = require('./src/app');
const { HOSTNAME, PORT } = require('./src/config');

// HOSTNAME is passed explicitly because the port-only form of listen binds every
// interface, and this socket must stay on loopback.
const server = createApp().listen(PORT, HOSTNAME);

// Express registers a callback passed to listen as the socket's error listener as well,
// so a failed bind would be handled and this line would still print success. Logging
// from 'listening' keeps the message success-only and leaves a bad bind fatal.
server.once('listening', () => {
  console.log(`Server running at http://${HOSTNAME}:${PORT}/`);
});
