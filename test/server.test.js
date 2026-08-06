/**
 * Smoke suite for the Express server in ../server.js.
 *
 * These three cases are the executable form of this tutorial's acceptance
 * criteria: the original greeting still works, the new greeting works, and
 * anything else is a plain-text 404.
 *
 * Run it with `npm test`, which is defined as a bare `node --test`. Node's
 * default test-file matching picks this file up from the `.test.js` suffix.
 *
 * Deliberate choices worth knowing before you edit this file:
 *
 *   - Zero third-party packages. Everything here comes from Node itself:
 *     `node:test` for the runner, `node:assert/strict` for the assertions,
 *     and the built-in global `fetch` for the requests. The project therefore
 *     needs no devDependencies at all.
 *
 *   - The suite binds the server itself, on port 0. `require('../server.js')`
 *     returns the Express app without opening a socket, because server.js only
 *     calls `listen` when it is the process entry point. Port 0 lets the kernel
 *     pick a free port, so these tests never collide with an already-running
 *     copy of the server — and the real port is never hardcoded here.
 *
 *   - Response bodies are compared byte for byte. `Hello, World!\n` is the
 *     exact 14-byte payload the pre-Express server returned, so this suite is a
 *     genuine regression guard on that endpoint rather than a loose smoke check.
 *
 *   - Content-Type is matched by prefix, never by equality. Express appends a
 *     charset when it serialises a string body, so the live header value is
 *     `text/plain; charset=utf-8` and an exact match against `text/plain`
 *     would fail.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const app = require('../server.js');

// Shared across the hooks and all three tests.
let server;
let baseUrl;

before(async () => {
  // Port 0 => the kernel assigns a free port. The `error` listener means a
  // failed bind rejects here instead of hanging the suite indefinitely.
  await new Promise((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', resolve);
    server.once('error', reject);
  });

  // Safe only after the listening callback above has fired.
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
  const contentType = res.headers.get('content-type') ?? '';

  assert.equal(res.status, 200);
  assert.ok(
    contentType.startsWith('text/plain'),
    `expected Content-Type to start with text/plain, got: ${contentType || '(absent)'}`,
  );
  // Byte-exact: comma, capital W, exclamation mark, trailing newline. 14 bytes.
  assert.equal(await res.text(), 'Hello, World!\n');
});

test('GET /good-evening returns the new "Good evening" greeting', async () => {
  const res = await fetch(`${baseUrl}/good-evening`);

  assert.equal(res.status, 200);
  // Byte-exact: 13 bytes, matching the trailing-newline convention above.
  assert.equal(await res.text(), 'Good evening\n');
});

test('an unmatched path returns a plain-text 404', async () => {
  const res = await fetch(`${baseUrl}/no-such-path`);
  const contentType = res.headers.get('content-type') ?? '';

  assert.equal(res.status, 404);
  // The point of this case: server.js has its own terminal handler precisely so
  // that misses stay plain text. Express's built-in 404 would return HTML here.
  assert.ok(
    contentType.startsWith('text/plain'),
    `expected Content-Type to start with text/plain, got: ${contentType || '(absent)'}`,
  );
});
