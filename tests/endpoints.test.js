const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const createApp = require('../src/app');

// Bind an ephemeral port so the suite never collides with a live server on 3000.
let server;
let base;

before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('GET / returns 200 text/plain with the exact 14-byte literal', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/plain');
  assert.equal(await res.text(), 'Hello, World!\n');
});

test('GET /good-evening returns 200 text/plain with the exact 13-byte literal', async () => {
  const res = await fetch(`${base}/good-evening`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/plain');
  assert.equal(await res.text(), 'Good evening\n');
});

test('an unknown path returns 404 with a text/plain body, never framework HTML', async () => {
  const res = await fetch(`${base}/no-such-path`);
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('content-type'), 'text/plain');
  assert.equal(await res.text(), 'Not Found\n');
});

test('a non-GET method on / returns 404 text/plain (documented delta A3)', async () => {
  const res = await fetch(`${base}/`, { method: 'POST' });
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('content-type'), 'text/plain');
});
