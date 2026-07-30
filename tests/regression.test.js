const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const createApp = require('../src/app');

// The backward-compatibility lock: asserts the properties most likely to drift
// silently once a framework sits under the response path.
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

test('Content-Length is exactly 14 on / and 13 on /good-evening', async () => {
  const root = await fetch(`${base}/`);
  assert.equal(root.headers.get('content-length'), '14');
  await root.text();

  const evening = await fetch(`${base}/good-evening`);
  assert.equal(evening.headers.get('content-length'), '13');
  await evening.text();
});

test('no ETag header is emitted on either endpoint', async () => {
  for (const path of ['/', '/good-evening']) {
    const res = await fetch(`${base}${path}`);
    assert.equal(res.headers.get('etag'), null, `ETag leaked on ${path}`);
    await res.text();
  }
});

test('no X-Powered-By header is emitted on either endpoint', async () => {
  for (const path of ['/', '/good-evening']) {
    const res = await fetch(`${base}${path}`);
    assert.equal(res.headers.get('x-powered-by'), null, `X-Powered-By leaked on ${path}`);
    await res.text();
  }
});

test('Content-Type carries no charset parameter on any path', async () => {
  for (const path of ['/', '/good-evening', '/no-such-path']) {
    const res = await fetch(`${base}${path}`);
    assert.equal(res.headers.get('content-type'), 'text/plain', `type drifted on ${path}`);
    await res.text();
  }
});

// HEAD is derived from the GET handler. Node suppresses body-length derivation
// for HEAD, so the baseline core-http server emitted no Content-Length here
// either - asserting one would demand a header the baseline never sent.
test('HEAD / returns 200 text/plain with no body, matching the baseline', async () => {
  const res = await fetch(`${base}/`, { method: 'HEAD' });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/plain');
  assert.equal(res.headers.get('content-length'), null);
  assert.equal(await res.text(), '');
});

test('HEAD /good-evening returns 200 text/plain with no body', async () => {
  const res = await fetch(`${base}/good-evening`, { method: 'HEAD' });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/plain');
  assert.equal(await res.text(), '');
});
