/**
 * @fileoverview Minimal "Hello, World!" HTTP server for the `hello_world` package
 * (repository: hao-backprop-test). Built exclusively on the Node.js core `http`
 * module with zero third-party dependencies. This server is a deliberate CATCH-ALL:
 * every incoming request - regardless of HTTP method or URL path - receives an
 * identical response of status 200, Content-Type `text/plain`, and body
 * `"Hello, World!\n"`. It binds to the loopback interface 127.0.0.1 on port 3000,
 * so it is reachable only from the local machine. There is no routing, request
 * parsing, error handling, or module export.
 *
 * Source: server.js:1-14
 * @module server
 * @see README.md - setup, API reference, configuration, and deployment guide.
 */

const http = require('http'); // Load the Node.js built-in `http` core module (no npm install required).

const hostname = '127.0.0.1'; // Loopback host; 127.0.0.1 keeps the server reachable from the local machine only.
const port = 3000;            // TCP port the HTTP server listens on for incoming connections.

/**
 * Request handler for every incoming HTTP request. This is a catch-all: the request
 * method and URL are ignored and a fixed 200 / text/plain / "Hello, World!\n"
 * response is always returned.
 *
 * Source: server.js:6-10
 * @param {http.IncomingMessage} req - Incoming request (method, url, headers). Intentionally unused.
 * @param {http.ServerResponse} res - Response stream used to set status, headers, and body.
 * @returns {void} Nothing is returned; the reply is written directly to `res`.
 */
const server = http.createServer((req, res) => { // Create the HTTP server and register the catch-all handler documented above.
  res.statusCode = 200;                          // Set the HTTP status code to 200 (OK) for every request.
  res.setHeader('Content-Type', 'text/plain');   // Declare the response body's MIME type as plain text.
  res.end('Hello, World!\n');                    // Write the response body ('Hello, World!' plus a trailing newline) and end the response.
});                                              // Close the http.createServer() call.

/**
 * "listening" callback, invoked once the server has bound to the configured host
 * and port and is ready to accept connections. Side effect only: prints the
 * server URL to stdout.
 *
 * Source: server.js:12-14
 * @returns {void} Nothing is returned; it only logs a startup message.
 */
server.listen(port, hostname, () => {                           // Bind to the port and hostname, then start accepting connections.
  console.log(`Server running at http://${hostname}:${port}/`); // Log the reachable URL, confirming a successful start.
});                                                             // Close the server.listen() call.
