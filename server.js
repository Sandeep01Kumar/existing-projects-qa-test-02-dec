// Bootstrap flow: the process entry point, and the only flow this file owns.
//
// Everything the baseline server did inline now sits behind two requires - the
// pipeline is composed in src/app.js, the constants live in src/config - which leaves
// this file the one decision neither of those modules is allowed to make: where the
// socket listens. Nothing else belongs here. No route, no request handler, no
// response write, no middleware, no express() call, no host or port literal; each of
// those has a module of its own.
//
// The host is passed to listen alongside the port, and that argument is mandatory.
// The framework's canonical starter form takes the port alone and therefore binds
// every interface. This socket must stay on loopback - that isolation is the system's
// primary security control - so dropping the host argument is a silent regression
// rather than a simplification.
//
// createApp is invoked here because src/app.js returns an unbound application;
// binding is this file's job alone, which is also what lets the test suites drive the
// very same pipeline on an ephemeral port instead of needing the project's default
// port to be free.
//
// Two omissions are deliberate. The host and port arrive from src/config as source
// literals, never from the environment, a .env file, or argv. And no failure handler
// is registered here: a bind failure such as an address already in use still crashes
// the process loudly, unchanged from the baseline. The system's only error handling
// is the terminal middleware mounted inside the application.
//
// That second omission is why listen is called with no callback. The framework
// installs any callback handed to listen as the socket's error listener as well, which
// turns a failed bind into a handled event: the address-in-use error would be
// swallowed, this line would still print, and the process would exit reporting
// success. Logging from the socket's own 'listening' event instead keeps the message
// success-only and leaves the failure path unhandled, so a bad bind still crashes.
//
// The startup line is a preserved contract, byte for byte down to the trailing slash
// - interpolating HOSTNAME and PORT reproduces the original message exactly.
const createApp = require('./src/app');
const { HOSTNAME, PORT } = require('./src/config');

const server = createApp().listen(PORT, HOSTNAME);

server.once('listening', () => {
  console.log(`Server running at http://${HOSTNAME}:${PORT}/`);
});
