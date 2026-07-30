const { after, before, describe, test } = require('node:test');
const assert = require('node:assert/strict');

const createApp = require('../src/app');

const HELLO_BODY = 'Hello, World!\n';
const GOOD_EVENING_BODY = 'Good evening\n';
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
  test('responds with status 404', async () => {
    const response = await fetch(`${baseUrl}/nope`);
    await response.text();
    assert.equal(response.status, 404);
  });

  test('responds with text/plain and the plain-text body, never framework HTML', async () => {
    const response = await fetch(`${baseUrl}/nope`);
    const body = await response.text();
    assert.equal(response.headers.get('content-type'), MEDIA_TYPE);
    assert.equal(body, NOT_FOUND_BODY);
  });
});
