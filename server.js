/**
 * Express tutorial server.
 *
 * A minimal Node.js HTTP server built with the Express.js web framework.
 * It exposes two GET endpoints on http://127.0.0.1:3000 :
 *   GET /             -> "Hello world"
 *   GET /good-morning -> "Good morning"
 *
 * This file is the single source of truth for the README endpoint table,
 * the curl examples, and the Mermaid routing diagram; those docs MUST match
 * the route paths, HTTP method, and response bodies defined here.
 *
 * Any request path that does not match a defined route falls through to
 * Express's built-in 404 handler.
 */
const express = require('express');

// Instantiate the Express application that provides path-based routing.
const app = express();

// Network configuration (preserved from the original tutorial server).
const hostname = '127.0.0.1';
const port = 3000;

/**
 * GET / route handler.
 *
 * Responds with the plain-text body "Hello world" and HTTP status 200.
 *
 * @param {express.Request} req - Incoming HTTP request.
 * @param {express.Response} res - HTTP response; sends the body "Hello world".
 * @returns {void}
 */
app.get('/', (req, res) => {
  res.type('text/plain').send('Hello world');
});

/**
 * GET /good-morning route handler.
 *
 * Responds with the plain-text body "Good morning" and HTTP status 200.
 *
 * @param {express.Request} req - Incoming HTTP request.
 * @param {express.Response} res - HTTP response; sends the body "Good morning".
 * @returns {void}
 */
app.get('/good-morning', (req, res) => {
  res.type('text/plain').send('Good morning');
});

// Start listening for connections. In Express 5 the listen callback receives
// any startup error (for example EADDRINUSE when the port is already in use) as
// its first argument, because the callback is attached to the server's "error"
// event as well as "listening". We therefore branch on that argument: the exact
// success URL is logged only once the socket is actually bound, and any failure
// is reported with a nonzero exit code so callers never observe a false success.
app.listen(port, hostname, (error) => {
  if (error) {
    console.error(`Server failed to start: ${error.code || 'unknown error'}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Server running at http://${hostname}:${port}/`);
});
