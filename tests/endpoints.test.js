// Endpoint-contract flow, and nothing else. This suite proves the observable HTTP
// surface of the application: for each declared route, and for a request that matches
// none of them, the status code, the exact Content-Type value, and the exact response
// body down to the byte.
//
// Its sibling, tests/regression.test.js, owns the backward-compatibility lock -
// Content-Length parity, the absence of the framework's added headers, HEAD semantics,
// and the intentional behavioural deltas. That split is deliberate and must be
// preserved: one file per flow, so a failure names its own cause. Nothing from the
// regression lock belongs here, and the two files deliberately repeat the harness
// below rather than share a helper module, which keeps each suite runnable and
// readable on its own.
//
// Only four things are in scope as imports: the runtime's built-in test runner, its
// strict assertion module, the global fetch API, and the application factory. The
// manifest declares no devDependencies and none will be added, so a third-party test
// import would not resolve at load time and would break `npm test` outright.
const { after, before, describe, test } = require('node:test');
const assert = require('node:assert/strict');

const createApp = require('../src/app');

// The expected wire literals, spelled out here rather than imported from the modules
// under test. Importing them would make every body assertion tautological - the suite
// would agree with whatever the implementation happened to emit. Restating them is
// what turns these tests into a contract.
//
// Note the exact shape of the first one: comma after Hello, capital W, exclamation
// mark, and a single trailing newline. The manifest's description field spells that
// greeting more loosely, and it is the wording people tend to quote from memory, but
// that text never reaches the wire; the response body has always been the literal
// below.
const HELLO_BODY = 'Hello, World!\n';
const GOOD_EVENING_BODY = 'Good evening\n';
const NOT_FOUND_BODY = 'Not Found\n';

// Exactly this value, with no charset parameter appended. The shared emitter reaches
// the raw response API directly for precisely this reason: every framework convenience
// helper rewrites the header to `text/plain; charset=utf-8`, or to `text/html` when no
// type is set at all.
const MEDIA_TYPE = 'text/plain';

let server;
let baseUrl;

// One server for the whole file, started once and torn down once.
//
// Port 0 asks the operating system for any free port, which is what lets this suite
// run while a real server already holds the project's default port - the two never
// compete. The host argument is passed for the same reason the bootstrap passes it:
// the socket stays on loopback rather than being offered on every interface.
//
// The bind is awaited through the socket's own events rather than a timer. Resolving
// on 'listening' means the first fetch cannot race the bind, and rejecting on 'error'
// means a bind failure surfaces as a failed run instead of a hang. No polling loop, no
// sleep, no retry.
before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

// Teardown, so the run ends instead of hanging. Successful replies carry
// `Keep-Alive: timeout=5`, so fetch's connection pool holds sockets open after the
// last assertion; closing those first means `close` has nothing left to wait for.
// Awaiting its callback keeps the hook honest - it does not report done until the
// listener is actually released.
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

// Every test issues its own request. That independence is the point: no test inherits a
// response another one fetched, so a single failure localises to a single behaviour and
// the tests may run in any order.
//
// Where a test asserts only on the status line or a header, the body is still read to
// completion. An unread body leaves its socket checked out of fetch's pool, which is
// tidy work rather than a correctness fix, but it keeps teardown deterministic.

describe('GET / (existing Hello endpoint, F-002 preserved)', () => {
  test('responds with status 200', async () => {
    const response = await fetch(`${baseUrl}/`);
    await response.text();
    assert.equal(response.status, 200);
  });

  // Strict equality, never a substring or pattern match. A containment check on this
  // header would still pass with `; charset=utf-8` appended, which is exactly the drift
  // this assertion exists to catch.
  test('responds with Content-Type exactly text/plain', async () => {
    const response = await fetch(`${baseUrl}/`);
    await response.text();
    assert.equal(response.headers.get('content-type'), MEDIA_TYPE);
  });

  // Two assertions, because one of them cannot be trusted alone. The string comparison
  // proves the characters; the byte count proves the trailing newline, which is part of
  // the contract yet invisible in a diff. The 14 stays a literal on purpose - deriving
  // it from HELLO_BODY would only restate the constant instead of checking it.
  test('responds with the exact 14-byte body, trailing newline included', async () => {
    const response = await fetch(`${baseUrl}/`);
    const body = await response.text();
    assert.equal(body, HELLO_BODY);
    assert.equal(Buffer.byteLength(body), 14);
  });
});

describe('GET /good-evening (new endpoint, F-007)', () => {
  // Lowercase kebab-case in the URL. The module behind it is named goodEvening.routes.js
  // in camelCase; the path is not, and only the path is a contract with clients.
  test('responds with status 200', async () => {
    const response = await fetch(`${baseUrl}/good-evening`);
    await response.text();
    assert.equal(response.status, 200);
  });

  // The new endpoint answers through the same single emitter as the original one, so it
  // is held to the same exact header value - this route must not be the one that
  // introduces a charset parameter.
  test('responds with Content-Type exactly text/plain', async () => {
    const response = await fetch(`${baseUrl}/good-evening`);
    await response.text();
    assert.equal(response.headers.get('content-type'), MEDIA_TYPE);
  });

  // 13 bytes: the twelve characters the request asked for, plus one trailing newline for
  // symmetry with the response that was already here.
  test('responds with the exact 13-byte body, trailing newline included', async () => {
    const response = await fetch(`${baseUrl}/good-evening`);
    const body = await response.text();
    assert.equal(body, GOOD_EVENING_BODY);
    assert.equal(Buffer.byteLength(body), 13);
  });
});

describe('unmatched route (F-008-RQ-001)', () => {
  // This is the behaviour that genuinely changed. Before routing existed, every path
  // answered 200 with the Hello body, so a mistyped URL succeeded silently and the two
  // endpoints would have been indistinguishable from client error. A miss now has to
  // announce itself.
  test('responds with status 404', async () => {
    const response = await fetch(`${baseUrl}/nope`);
    await response.text();
    assert.equal(response.status, 404);
  });

  // The body assertion is the load-bearing half of this test. Left to the framework, an
  // unmatched request returns an HTML error page carrying Content-Security-Policy and
  // X-Content-Type-Options - a content type this system has never emitted. Checking the
  // header alone would not distinguish the project's own route-miss handler from a
  // default that merely happened to be labelled correctly; checking the body proves
  // which one ran.
  test('responds with text/plain and the plain-text body, never framework HTML', async () => {
    const response = await fetch(`${baseUrl}/nope`);
    const body = await response.text();
    assert.equal(response.headers.get('content-type'), MEDIA_TYPE);
    assert.equal(body, NOT_FOUND_BODY);
  });
});
