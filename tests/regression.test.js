const { after, before, describe, test } = require('node:test');
const assert = require('node:assert/strict');

const createApp = require('../src/app');

const NOT_FOUND_BODY = 'Not Found\n';
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
// also change the response headers, which is precisely the drift the header-fingerprint
// group below exists to catch - the teardown must not be the thing that breaks the lock
// it is here to protect.
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

describe('Content-Length parity', () => {
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
  // Both routes serve GET, and HEAD is derived from them, so a bodiless probe of either
  // resource must still succeed. Draining the (empty) body releases the connection; its
  // value is deliberately not asserted, because a HEAD reply has no body by definition.
  test('HEAD / responds with status 200', async () => {
    const response = await fetch(`${baseUrl}/`, { method: 'HEAD' });
    await response.text();
    assert.equal(response.status, 200);
  });

  test('HEAD / reports the representation length 14', async () => {
    const response = await fetch(`${baseUrl}/`, { method: 'HEAD' });
    await response.text();
    assert.equal(response.headers.get('content-length'), '14');
  });

  test('HEAD /good-evening responds with status 200 and reports the representation length 13', async () => {
    const response = await fetch(`${baseUrl}/good-evening`, { method: 'HEAD' });
    await response.text();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-length'), '13');
  });
});

describe('intentional behavioural deltas', () => {
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

  // Router defaults accept case/trailing-slash aliases; lock exact GET/HEAD paths to the 404 contract.
  for (const path of ['//', '/good-evening/', '/GOOD-EVENING', '/Good-Evening']) {
    for (const method of ['GET', 'HEAD']) {
      test(`${method} ${path} is not an alias and returns the plain-text 404`, async () => {
        const response = await fetch(`${baseUrl}${path}`, { method });
        const body = await response.text();
        assert.equal(response.status, 404);
        assert.equal(response.headers.get('content-type'), MEDIA_TYPE);
        if (method === 'GET') {
          assert.equal(body, NOT_FOUND_BODY);
        }
      });
    }
  }

  // Keep explicit route-level OPTIONS handlers from regressing to Express's automatic 200/Allow response.
  for (const path of ['/', '/good-evening']) {
    test(`OPTIONS ${path} returns 404 plain text with no Allow or nosniff header`, async () => {
      const response = await fetch(`${baseUrl}${path}`, { method: 'OPTIONS' });
      const body = await response.text();
      assert.equal(response.status, 404);
      assert.equal(response.headers.get('content-type'), MEDIA_TYPE);
      assert.equal(body, NOT_FOUND_BODY);
      assert.equal(response.headers.get('allow'), null);
      assert.equal(response.headers.get('x-content-type-options'), null);
    });
  }
});
