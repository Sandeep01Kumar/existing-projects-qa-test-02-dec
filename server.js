/**
 * @fileoverview Minimal "Hello, World!" HTTP server for the `hello_world` package
 * (repository: hao-backprop-test). Built exclusively on the Node.js core `http`
 * module with zero third-party dependencies. The single request handler is a
 * deliberate catch-all: for every ordinary request delivered to the server's
 * `request` event it returns an identical response of status 200, Content-Type
 * `text/plain`, and body `"Hello, World!\n"`. The handler inspects neither the HTTP
 * method nor the URL path, so there is no routing, request parsing, error handling,
 * or module export. Two protocol-level behaviors are governed by Node.js itself and
 * are NOT overridden here: a HEAD request receives the same 200 status and headers
 * but an empty body, because Node.js automatically suppresses the response body for
 * HEAD; and a CONNECT request never reaches this `request` callback (it is emitted
 * on the server's `connect` event instead), so a raw CONNECT receives no HTTP
 * response. The server binds to the loopback interface 127.0.0.1 on port 3000, so it
 * is reachable only from the local machine.
 *
 * Source: server.js:22-58
 * @module server
 * @see README.md - setup, API reference, configuration, and deployment guide.
 */

const http = require('http'); // Load the Node.js built-in `http` core module (no npm install required).

const hostname = '127.0.0.1'; // Loopback host; 127.0.0.1 keeps the server reachable from the local machine only.
const port = 3000;            // TCP port the HTTP server listens on for incoming connections.

/**
 * Request handler registered for the server's `request` event. This is a catch-all:
 * for every ordinary request delivered to this callback the HTTP method and URL are
 * ignored and a fixed 200 / text/plain / "Hello, World!\n" response is written. Two
 * protocol-level exceptions are governed by Node.js, not by this callback: for a
 * HEAD request Node.js sends the 200 status and headers but suppresses the body, so
 * the client observes an empty body; and a CONNECT request never invokes this
 * callback (it is emitted on the server's `connect` event), so it receives no HTTP
 * response from this handler.
 *
 * Source: server.js:42-46
 * @param {http.IncomingMessage} req - Incoming request (method, url, headers). Intentionally unused.
 * @param {http.ServerResponse} res - Response stream used to set status, headers, and body.
 * @returns {void} Nothing is returned; the reply is written directly to `res`.
 */
const server = http.createServer((req, res) => { // Create the HTTP server and register the catch-all handler documented above.
  res.statusCode = 200;                          // Set the HTTP status code to 200 (OK) for every request handled by this callback.
  res.setHeader('Content-Type', 'text/plain');   // Declare the response body's MIME type as plain text.
  res.end('Hello, World!\n');                    // Write the response body ('Hello, World!' plus a trailing newline) and end the response.
});                                              // Close the http.createServer() call.

/**
 * "listening" callback, invoked once the server has bound to the configured host
 * and port and is ready to accept connections. Side effect only: prints the
 * server URL to stdout.
 *
 * Source: server.js:56-58
 * @returns {void} Nothing is returned; it only logs a startup message.
 */
server.listen(port, hostname, () => {                           // Bind to the port and hostname, then start accepting connections.
  console.log(`Server running at http://${hostname}:${port}/`); // Log the reachable URL, confirming a successful start.
});                                                             // Close the server.listen() call.
