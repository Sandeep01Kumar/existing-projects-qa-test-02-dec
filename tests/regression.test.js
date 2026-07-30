// Regression flow: the backward-compatibility lock, and the only flow this file owns.
//
// The endpoint contract - each route's status, media type and exact body - belongs to
// tests/endpoints.test.js. This file guards the properties that would drift SILENTLY
// instead: a Content-Length that no longer matches the literal, a framework header the
// pre-Express server never sent, and the two behavioural deltas that adding routing
// deliberately introduced. Nothing here re-proves a response body of a served route;
// keeping the two concerns in separate files is the separation this suite is built on,
// which is also why neither file borrows the other's harness.
//
// Each suite below locks one drift-prone property:
//   Content-Length parity   - the byte counts of both served routes, 14 and 13.
//   header fingerprint      - the absence of ETag and X-Powered-By, i.e. proof that
//                             the composition root still disables both. Forgetting
//                             either is invisible in a browser and free to regress:
//                             ETag returns as a weak validator hashed over every body,
//                             X-Powered-By as a framework advertisement.
//   HEAD semantics          - a bodiless request on the root route still succeeds.
//   behavioural deltas      - an unserved method and an undeclared path both answer
//                             404 in plain text. Before routing existed every request
//                             received the Hello response, so these two are the only
//                             intentional breaks in the observable contract; asserting
//                             them keeps a future catch-all from quietly restoring the
//                             old behaviour and making a typo'd path look successful.
//
// Only the runtime's own test runner, its assertion library, the global fetch client
// and the application factory are used. The suite adds no dependency of any kind, so
// it cannot contribute to the application's install size, startup time or memory.
const { after, before, describe, test } = require('node:test');
const assert = require('node:assert/strict');

const createApp = require('../src/app');

const NOT_FOUND_BODY = 'Not Found\n';
const MEDIA_TYPE = 'text/plain';

// Assigned once in the hook below and only read afterwards, so no test can influence
// another through them.
let server;
let baseUrl;

// One server for the whole file, bound on an EPHEMERAL port: passing 0 lets the kernel
// choose a free one, so this suite passes whether or not the project's default port is
// already serving. The loopback host is passed explicitly, matching the posture the
// application's own entry point defends. The port is unknowable until the socket is
// listening, hence awaiting that event instead of polling for it - the suite contains
// no timer, no retry and no arbitrary delay.
before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

// Tearing the socket down keeps the runner from hanging: 200 replies carry
// Keep-Alive, so the fetch client parks pooled connections that would otherwise hold
// the server open past the last assertion.
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

describe('Content-Length parity', () => {
  // Header values arrive as strings, and these assertions are strict, so the
  // comparands are quoted deliberately - the numbers 14 and 13 would not match.
  test('GET / reports Content-Length 14', async () => {
    const response = await fetch(`${baseUrl}/`);
    await response.text();
    assert.equal(response.headers.get('content-length'), '14');
  });

  test('GET /good-evening reports Content-Length 13', async () => {
    const response = await fetch(`${baseUrl}/good-evening`);
    await response.text();
    assert.equal(response.headers.get('content-length'), '13');
  });
});

describe('header fingerprint parity (F-006-RQ-003)', () => {
  // A missing header reads back as null through this client, so absence is asserted as
  // that exact value. A truthiness check would pass just as happily on an empty string
  // and would therefore prove less.
  test('no ETag header is emitted', async () => {
    const response = await fetch(`${baseUrl}/`);
    await response.text();
    assert.equal(response.headers.get('etag'), null);
  });

  test('no X-Powered-By header is emitted', async () => {
    const response = await fetch(`${baseUrl}/`);
    await response.text();
    assert.equal(response.headers.get('x-powered-by'), null);
  });
});

describe('HEAD semantics (decision A3)', () => {
  // The root route serves GET, and HEAD is derived from it, so a bodiless probe of the
  // same resource must still succeed. Status is the whole contract here: a HEAD reply
  // has no body to inspect by definition, and its representation metadata is a
  // property of the emitter rather than of this route, so asserting more would couple
  // this lock to an implementation detail it does not own. Draining the (empty) body
  // releases the connection; its value is deliberately not asserted.
  test('HEAD / responds with status 200', async () => {
    const response = await fetch(`${baseUrl}/`, { method: 'HEAD' });
    await response.text();
    assert.equal(response.status, 200);
  });
});

describe('intentional behavioural deltas', () => {
  // Both routes serve read-only text and are declared for GET alone, so any other
  // method is a route miss rather than a success. The media type is compared for exact
  // equality on purpose: a substring test would still pass if a charset parameter crept
  // back in, and it is the framework's own response helpers - unused here - that append
  // one.
  test('POST / returns 404 with a plain-text body', async () => {
    const response = await fetch(`${baseUrl}/`, { method: 'POST' });
    const body = await response.text();
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('content-type'), MEDIA_TYPE);
    assert.equal(body, NOT_FOUND_BODY);
  });

  // An undeclared path must fail loudly. Were it to fall through to the Hello response
  // the two endpoints would be indistinguishable from a client error, and a near miss
  // such as /good-evenin would silently look correct.
  test('GET /any-other-path returns 404 with a plain-text body', async () => {
    const response = await fetch(`${baseUrl}/any-other-path`);
    const body = await response.text();
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('content-type'), MEDIA_TYPE);
    assert.equal(body, NOT_FOUND_BODY);
  });
});
