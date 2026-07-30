# hao-backprop-test
test project for backprop integration. Do not touch!

## Prerequisites

- **Node.js 18 or newer.** This is the engine floor declared by
  `express@5.2.1` itself, and it is now recorded in `package.json` under
  `engines`. It supersedes the project's previous 14.x minimum. Validated on
  Node.js 22.x.
- **npm 7 or newer.** Required by `lockfileVersion 3` in the committed
  `package-lock.json`.
- **TCP port 3000 must be free.** The server binds `127.0.0.1:3000` and
  never falls back to another port.

## Install

An install step is now **required before the server can run**. This is new:
the project previously carried zero dependencies and needed no install at
all.

```bash
npm ci
```

`npm ci` is the documented command rather than `npm install` because it
installs deterministically from the committed lockfile, reproducing the
identical tree on every machine. That tree is `express@5.2.1` — the only
direct dependency — plus its transitive packages. The installed directory is
excluded from version control.

## Run

```bash
npm start
# or, equivalently
node server.js
```

`npm start` runs `node server.js`, so the two commands are interchangeable.
The socket is bound to the loopback interface only, which means the server
answers on this machine and on no other. On a successful bind it prints
exactly:

```text
Server running at http://127.0.0.1:3000/
```

Stop it with `Ctrl+C`. A failed bind — port 3000 already in use, for
example — is deliberately left unhandled: the process crashes loudly instead
of printing the line above and pretending to have started.

## Endpoints

| Method | Path | Status | Content-Type | Body | Bytes |
|--------|------|--------|--------------|------|-------|
| GET | `/` | 200 | `text/plain` | `Hello, World!\n` | 14 |
| GET | `/good-evening` | 200 | `text/plain` | `Good evening\n` | 13 |
| HEAD | `/` or `/good-evening` | 200 | `text/plain` | (no body, derived from GET) | — |
| any | any other path | 404 | `text/plain` | `Not Found\n` | 10 |
| any | (unhandled error) | 500 | `text/plain` | `Internal Server Error\n` | 22 |

The byte counts are part of the contract, trailing newline included, and the
test suite asserts them.

`Content-Type` is exactly `text/plain` on every response, with **no charset
parameter** appended. No `X-Powered-By` header and no `ETag` header is
emitted on any path, so the header block is identical to the one this server
sent before the framework was introduced. A `HEAD` reply carries no body but
still reports the representation length of the resource it names —
`Content-Length: 14` on `/` and `13` on `/good-evening`.

Verify a running server:

```bash
curl -i http://127.0.0.1:3000/
curl -i http://127.0.0.1:3000/good-evening
```

## Tests

```bash
npm test
```

This runs `node --test "tests/**/*.test.js"` on Node's **built-in test
runner**, so the suite adds **zero new dependencies** — the project has no
`devDependencies` at all. Each suite binds an **ephemeral port** rather than
3000, so `npm test` passes whether or not a server is already running on the
project's default port.

`tests/endpoints.test.js` covers the endpoint contract: status, content type
and the exact body of both endpoints, plus the plain-text 404 and the
plain-text 500. `tests/regression.test.js` is the backward-compatibility
lock: the exact content lengths, the absence of both added headers, `HEAD`
behaviour, and the two intentional deltas described below.

## Behaviour notes and intentional changes

Three behaviours are worth knowing before you probe the server. The first is
a guarantee; the other two are deliberate departures from how the
single-handler version behaved.

- **`GET /` is unchanged.** Same status, same 14 bytes down to the trailing
  newline, same content type, same loopback bind, same startup line. Adding
  the framework and the second endpoint changed nothing an existing caller
  of the root URL can observe.
- **Any other path now returns `404` with a `text/plain` body.** Previously
  one catch-all handler answered every path with the Hello response. A
  catch-all that kept doing so would make a typo such as `/good-evenin`
  look like a success, leaving the two endpoints indistinguishable from a
  client error — so an undeclared path now fails loudly instead.
- **Only `GET` and `HEAD` are served; every other method returns `404`.**
  `POST /`, `DELETE /` and `OPTIONS /` all reach the same plain-text
  route-miss reply. Two read-only text resources are correctly modelled as
  `GET`-only, and `HEAD` is derived from `GET` automatically. The previous
  version answered `200` to any method, which was an accident of the
  catch-all rather than a contract.

## Project structure

Each flow and feature owns exactly one module, so every file has a single
reason to change:

```text
server.js                          bootstrap flow - bind host/port, log
src/app.js                         composition flow - build app, mount order
src/config/index.js                configuration flow - host, port, media type
src/lib/textResponse.js            response-emission flow - the sole emitter
src/routes/hello.routes.js         Hello feature flow - GET /
src/routes/goodEvening.routes.js   Good-evening feature flow - GET /good-evening
src/middleware/optionsGuard.js     OPTIONS-suppression flow
src/middleware/notFound.js         route-miss flow - 404
src/middleware/errorHandler.js     error flow - 500
tests/endpoints.test.js            endpoint contract
tests/regression.test.js           backward-compatibility lock
```

Every response — success, route miss and failure alike — leaves through the
single emitter in `src/lib/textResponse.js`. That one choke point is why
`Content-Type` cannot drift away from exactly `text/plain`, and why no path
can fall back to the framework's default HTML error page.

## Notes

- `docs/features/express-endpoints.md` carries the full per-endpoint
  contract, including byte counts and the rationale for each behavioural
  delta.
- Configuration is intentionally hardcoded in source, in
  `src/config/index.js`. There are no environment variables to set and no
  command-line flags to pass; the host, port and media type are source
  literals, exactly as they were before.
- There is no build, transpile or bundle step. `npm ci` then `npm start` is
  the whole launch sequence.
- Measured performance, disclosed rather than glossed. Request latency moved
  from 3.700 ms to 3.716 ms mean — a 0.4% difference, inside measurement
  noise, against a budget of under 10 ms. Startup moved from 29 ms to 81 ms,
  consuming about 8% of the under-one-second budget. Resident memory moved
  from 53.8 MB to 71.0 MB — an increase of roughly 17.6 MB, and the one
  budget genuinely affected. Absolute figures vary with the machine you
  measure on; the direction and the scale do not. That memory increase is
  the unavoidable cost of loading the framework itself; no additional
  middleware layers were adopted, `ETag` generation is switched off, no
  request body is ever parsed, and both response literals are allocated once
  at module load rather than per request.
- The installed dependency tree is 595 files and a few megabytes on disk,
  excluded from version control; the repository's own source stays well
  under 1 MB.
