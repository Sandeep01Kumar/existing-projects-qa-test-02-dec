const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const app = require('../server.js');

// The hooks belong to a suite rather than to the file itself, and that placement is the
// whole reason this suite runs everywhere `engines.node` says it does. Node only began
// executing file-level `before`/`after` in 18.19.0 and 20.7.0: below those, a file-level
// `before` was skipped outright, leaving every request aimed at `undefined/`, and a
// file-level `after` never fired, so the still-listening socket held the process open
// until it was killed. Hooks attached to a suite have run since node:test first exported
// `before`/`after` in 18.8.0, which is exactly the floor the manifest declares.
describe('the endpoints served by server.js', () => {
  let server;
  let baseUrl;

  before(async () => {
    // Let the kernel choose a free port to avoid collisions with another server process.
    server = app.listen(0, '127.0.0.1');

    // `once` rejects with the real cause if the bind fails instead of resolving, and it
    // detaches both listeners it attached once settled, leaving nothing on the server.
    await once(server, 'listening');

    // Reading the port is safe only after the `listening` event above.
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    // Only a socket that actually bound has anything to release. `app.listen` returns a
    // server object even when the bind fails, so closing on existence alone would call
    // back with ERR_SERVER_NOT_RUNNING and pile an invented failure on top of the real
    // cause the failed `before` already reported. A close that genuinely fails still
    // rejects below, so real cleanup problems are not swallowed either.
    if (!server || !server.listening) return;

    // Release the port so the test process exits on its own instead of hanging.
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('GET / returns the preserved "Hello, World!" greeting as plain text', async () => {
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

  it('GET /good-evening returns the new "Good evening" greeting as plain text', async () => {
    const res = await fetch(`${baseUrl}/good-evening`);
    const contentType = res.headers.get('content-type') ?? '';

    assert.equal(res.status, 200);
    assert.ok(contentType.startsWith('text/plain'), `bad Content-Type: ${contentType || '(absent)'}`);
    // Byte-exact: 13 bytes, matching the trailing-newline convention above.
    assert.equal(await res.text(), 'Good evening\n');
  });

  it('an unmatched path returns the plain-text 404', async () => {
    const res = await fetch(`${baseUrl}/no-such-path`);
    const contentType = res.headers.get('content-type') ?? '';

    assert.equal(res.status, 404);
    // server.js registers its own terminal handler precisely so that misses stay
    // plain text — Express's built-in 404 would answer with HTML here.
    assert.ok(contentType.startsWith('text/plain'), `bad Content-Type: ${contentType || '(absent)'}`);
    assert.equal(await res.text(), 'Not Found\n');
  });
});
