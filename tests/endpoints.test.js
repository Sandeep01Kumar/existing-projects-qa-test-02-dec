const { after, before, describe, test } = require('node:test');
const assert = require('node:assert/strict');

const createApp = require('../src/app');

// Define expected wire literals independently so implementation changes cannot make
// the assertions tautological.
const HELLO_BODY = 'Hello, World!\n';
const GOOD_EVENING_BODY = 'Good evening\n';
const NOT_FOUND_BODY = 'Not Found\n';
const INTERNAL_ERROR_BODY = 'Internal Server Error\n';

const MEDIA_TYPE = 'text/plain';

// Records a server's live sockets for the fallback branch of closeServer below. Attached
// before the bind is awaited so no connection can slip past it, and each socket removes
// itself on close so the set only ever holds what is genuinely live.
const trackConnections = (server) => {
  const sockets = new Set();

  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });

  return sockets;
};

// Releases the listener, so the run ends instead of hanging - and so a teardown that
// FAILS is seen rather than passing silently.
//
// `close` goes first: it stops the listener accepting straight away and registers the
// completion callback. Only then are the pooled sockets released. Successful replies
// carry `Keep-Alive: timeout=5`, so fetch parks connections that would otherwise hold
// `close` open for the whole idle timeout, and clearing them while `close` is already
// pending removes that wait without leaving a window for a fresh connection to be
// accepted behind the sweep. `closeAllConnections` clears them in one call but is not
// present on every runtime, so it sits behind a capability check and the tracked sockets
// are destroyed by hand otherwise. The sweep deliberately never touches keep-alive
// itself: disabling it would be a shorter route to the same quiet teardown and would
// change the response headers, which is the exact drift the sibling regression suite
// exists to catch.
//
// The close callback's first argument is an Error, so handing `resolve` straight to
// `close` would resolve successfully WITH that error as its value and hide a listener
// that never came free. It is rejected explicitly instead.
const closeServer = (server, sockets) =>
  new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));

    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
      return;
    }

    for (const socket of sockets) {
      socket.destroy();
    }

    sockets.clear();
  });

let server;
let sockets;
let baseUrl;

// Bind an independent loopback listener on port 0 and await 'listening' so requests
// cannot race startup or collide with port 3000.
before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  sockets = trackConnections(server);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await closeServer(server, sockets);
});

// Consume otherwise-uninspected bodies so fetch can release pooled connections before
// teardown.

describe('GET / (existing Hello endpoint, F-002 preserved)', () => {
  test('responds with status 200', async () => {
    const response = await fetch(`${baseUrl}/`);
    await response.text();
    assert.equal(response.status, 200);
  });

  test('responds with Content-Type exactly text/plain', async () => {
    const response = await fetch(`${baseUrl}/`);
    await response.text();
    assert.equal(response.headers.get('content-type'), MEDIA_TYPE);
  });

  test('responds with the exact 14-byte body, trailing newline included', async () => {
    const response = await fetch(`${baseUrl}/`);
    const body = await response.text();
    assert.equal(body, HELLO_BODY);
    assert.equal(Buffer.byteLength(body), 14);
  });
});

describe('GET /good-evening (new endpoint, F-007)', () => {
  test('responds with status 200', async () => {
    const response = await fetch(`${baseUrl}/good-evening`);
    await response.text();
    assert.equal(response.status, 200);
  });

  test('responds with Content-Type exactly text/plain', async () => {
    const response = await fetch(`${baseUrl}/good-evening`);
    await response.text();
    assert.equal(response.headers.get('content-type'), MEDIA_TYPE);
  });

  test('responds with the exact 13-byte body, trailing newline included', async () => {
    const response = await fetch(`${baseUrl}/good-evening`);
    const body = await response.text();
    assert.equal(body, GOOD_EVENING_BODY);
    assert.equal(Buffer.byteLength(body), 13);
  });
});

describe('unmatched route (F-008-RQ-001)', () => {
  // An undeclared path must return 404 so a mistyped endpoint cannot appear successful.
  test('responds with status 404', async () => {
    const response = await fetch(`${baseUrl}/nope`);
    await response.text();
    assert.equal(response.status, 404);
  });

  // Assert both type and body so route misses cannot regress to the framework's
  // default HTML response.
  test('responds with text/plain and the plain-text body, never framework HTML', async () => {
    const response = await fetch(`${baseUrl}/nope`);
    const body = await response.text();
    assert.equal(response.headers.get('content-type'), MEDIA_TYPE);
    assert.equal(body, NOT_FOUND_BODY);
  });
});

// The failure has to be injected: both endpoints write a constant string with no I/O and
// nothing to throw on, and an error sink that is never executed is an unproven claim -
// it could answer with the wrong status, the wrong media type, or the framework's
// default HTML page while every test above still passed. The flows go through the
// factory because mounting only ever APPENDS: a flow added to an already-composed
// application would sit behind the route-miss handler and never run, so only one handed
// to the factory lands ahead of the terminal pair where the error sink has to answer it.
//
// Both failure modes the requirement names are covered - a rejected promise, which this
// framework's major line forwards to error middleware automatically, and a synchronous
// throw. Each is scoped to its own path so one server hosts both and every other path on
// it stays untouched, which is why the flows call next() rather than short-circuiting.
// No mock, no stub, no patched framework internals, and no dependency the suites above
// do not already use.
//
// The three-parameter shape is structural: the framework passes request, response and
// continuation positionally, so next has to be third, and a fourth parameter would make
// the framework read the function as an error handler instead. Hence res is declared even
// though neither flow ever writes a response - only the error sink does.
const REJECTED_PROMISE_PATH = '/rejected-promise';
const THROWN_ERROR_PATH = '/thrown-error';

const rejectingFlow = (req, res, next) => {
  if (req.path === REJECTED_PROMISE_PATH) {
    return Promise.reject(new Error('deliberate rejection from the endpoint contract suite'));
  }

  next();
};

const throwingFlow = (req, res, next) => {
  if (req.path === THROWN_ERROR_PATH) {
    throw new Error('deliberate throw from the endpoint contract suite');
  }

  next();
};

describe('failed request (F-008-RQ-002)', () => {
  // A second listener with its own lifecycle, so the suites above keep exercising a
  // pipeline composed exactly as the running server composes it.
  let failingServer;
  let failingSockets;
  let failingBaseUrl;

  before(async () => {
    failingServer = createApp([rejectingFlow, throwingFlow]).listen(0, '127.0.0.1');
    failingSockets = trackConnections(failingServer);
    await new Promise((resolve, reject) => {
      failingServer.once('listening', resolve);
      failingServer.once('error', reject);
    });
    failingBaseUrl = `http://127.0.0.1:${failingServer.address().port}`;
  });

  after(async () => {
    await closeServer(failingServer, failingSockets);
  });

  test('a handler returning a rejected promise responds with status 500', async () => {
    const response = await fetch(`${failingBaseUrl}${REJECTED_PROMISE_PATH}`);
    await response.text();
    assert.equal(response.status, 500);
  });

  // The body assertion is what proves which handler answered: left to the framework, an
  // unhandled failure returns an HTML error page carrying the stack trace, and a header
  // check alone would not tell this project's error sink apart from a default that merely
  // happened to be labelled plain text.
  test('a rejected promise answers text/plain with the exact body, never HTML', async () => {
    const response = await fetch(`${failingBaseUrl}${REJECTED_PROMISE_PATH}`);
    const body = await response.text();
    assert.equal(response.headers.get('content-type'), MEDIA_TYPE);
    assert.equal(body, INTERNAL_ERROR_BODY);
  });

  // A synchronous throw travels a different route into the same sink - one requires the
  // framework to catch, the other to follow a rejected promise - so it is asserted
  // separately. Both must land on the identical reply.
  test('a handler that throws synchronously produces the identical 500 reply', async () => {
    const response = await fetch(`${failingBaseUrl}${THROWN_ERROR_PATH}`);
    const body = await response.text();
    assert.equal(response.status, 500);
    assert.equal(response.headers.get('content-type'), MEDIA_TYPE);
    assert.equal(body, INTERNAL_ERROR_BODY);
  });

  // Without this, a passing 500 could be masking a fixture that hijacks the whole
  // pipeline, and the assertions above would prove nothing about the routes.
  test('the injected flows leave every other path untouched', async () => {
    const helloResponse = await fetch(`${failingBaseUrl}/`);
    const helloBody = await helloResponse.text();
    assert.equal(helloResponse.status, 200);
    assert.equal(helloBody, HELLO_BODY);

    const missResponse = await fetch(`${failingBaseUrl}/nope`);
    const missBody = await missResponse.text();
    assert.equal(missResponse.status, 404);
    assert.equal(missBody, NOT_FOUND_BODY);
  });
});
