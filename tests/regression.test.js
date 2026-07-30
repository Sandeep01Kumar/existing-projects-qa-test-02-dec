const { after, before, describe, test } = require('node:test');
const assert = require('node:assert/strict');

const createApp = require('../src/app');

const NOT_FOUND_BODY = 'Not Found\n';
const MEDIA_TYPE = 'text/plain';

// Bind an ephemeral port so the suite never collides with a live server on the
// project's default port.
let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
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
  // A HEAD reply carries the representation metadata of the GET it derives from:
  // no body, but the resource's Content-Length. Node cannot measure a body it
  // never writes, so the emitter sets that header explicitly.
  test('HEAD / responds with status 200, no body and Content-Length 14', async () => {
    const response = await fetch(`${baseUrl}/`, { method: 'HEAD' });
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), MEDIA_TYPE);
    assert.equal(response.headers.get('content-length'), '14');
    assert.equal(body, '');
  });

  test('HEAD /good-evening responds with status 200, no body and Content-Length 13', async () => {
    const response = await fetch(`${baseUrl}/good-evening`, { method: 'HEAD' });
    const body = await response.text();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), MEDIA_TYPE);
    assert.equal(response.headers.get('content-length'), '13');
    assert.equal(body, '');
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

  test('GET /any-other-path returns 404 with a plain-text body', async () => {
    const response = await fetch(`${baseUrl}/any-other-path`);
    const body = await response.text();
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('content-type'), MEDIA_TYPE);
    assert.equal(body, NOT_FOUND_BODY);
  });

  // The framework answers OPTIONS on a declared path itself unless it is intercepted,
  // which would both succeed on an unserved method and add headers the pre-Express
  // server never sent.
  for (const path of ['/', '/good-evening']) {
    test(`OPTIONS ${path} returns 404 and adds no framework headers`, async () => {
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
