const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const app = require('../server.js');

let server;
let baseUrl;

before(async () => {
  // Let the kernel choose a free port to avoid collisions with another server process.
  server = app.listen(0, '127.0.0.1');

  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  // Reading the port is safe only after the `listening` event above.
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
  // Guard against exposing the framework through the X-Powered-By header.
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
