/**
 * Smoke suite for the Express server in ../server.js — the executable form of
 * this tutorial's acceptance criteria: the original greeting still works, the
 * new greeting works, and an unmatched path is a plain-text 404.
 *
 * Everything here comes from Node itself — `node:test`, `node:assert/strict`
 * and the global `fetch` — so the project needs no devDependencies. Run it with
 * `npm test`, which is a bare `node --test`, on Node 18.8.0 or newer: that is
 * the release that introduced the top-level hooks used below.
 *
 * One shared server serves the whole suite: the `before` hook binds it once and
 * the `after` hook closes it once. `require('../server.js')` returns the app
 * without opening a socket, because server.js only calls `listen` when it is
 * the process entry point.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const app = require('../server.js');

// Shared by the hooks and all three tests.
let server;
let baseUrl;

before(async () => {
  await new Promise((resolve, reject) => {
    // Port 0 lets the kernel pick a free port, so the suite never collides with
    // an already-running copy of the server. `listen` reports a failed bind
    // through this same callback, so reject on `err` instead of resolving and
    // failing later on with the real cause lost.
    server = app.listen(0, '127.0.0.1', (err) => (err ? reject(err) : resolve()));
  });

  // Reading the port is safe only after the listening callback above fired.
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  // Release the port so the test process exits on its own instead of hanging.
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

test('GET / returns the preserved "Hello, World!" greeting as plain text', async () => {
  const res = await fetch(`${baseUrl}/`);
  // Prefix, never equality: Express appends a charset when it serialises a
  // string body, so the live header value is `text/plain; charset=utf-8`.
  const contentType = res.headers.get('content-type') ?? '';

  assert.equal(res.status, 200);
  assert.ok(contentType.startsWith('text/plain'), `bad Content-Type: ${contentType || '(absent)'}`);
  // server.js disables x-powered-by, so the framework is never advertised.
  assert.equal(res.headers.get('x-powered-by'), null);
  // Byte-exact: comma, capital W, exclamation mark, trailing newline. 14 bytes.
  assert.equal(await res.text(), 'Hello, World!\n');
});

test('GET /good-evening returns the new "Good evening" greeting as plain text', async () => {
  const res = await fetch(`${baseUrl}/good-evening`);
  const contentType = res.headers.get('content-type') ?? '';

  assert.equal(res.status, 200);
  assert.ok(contentType.startsWith('text/plain'), `bad Content-Type: ${contentType || '(absent)'}`);
  // Byte-exact: 13 bytes, matching the trailing-newline convention above.
  assert.equal(await res.text(), 'Good evening\n');
});

test('an unmatched path returns the plain-text 404', async () => {
  const res = await fetch(`${baseUrl}/no-such-path`);
  const contentType = res.headers.get('content-type') ?? '';

  assert.equal(res.status, 404);
  // server.js registers its own terminal handler precisely so that misses stay
  // plain text — Express's built-in 404 would answer with HTML here.
  assert.ok(contentType.startsWith('text/plain'), `bad Content-Type: ${contentType || '(absent)'}`);
  assert.equal(await res.text(), 'Not Found\n');
});
