# hao-backprop-test
test project for backprop integration. Do not touch!

## What this is

A minimal Node.js HTTP server, now built on the Express application framework, serving two
plain-text endpoints on the loopback interface. The full per-endpoint contract lives in
[`docs/features/express-endpoints.md`](docs/features/express-endpoints.md); this page is the
quick start.

## Prerequisites

- **Run it on Node.js 22.12.0 or newer** — a currently supported LTS line. This is the
  project's supported runtime, and it is the floor to use for anything beyond a throwaway
  local read of the code.
- **Do not run it on Node 18 or Node 20.** Both lines have reached end-of-life and no longer
  receive security patches, so an unpatched runtime or HTTP-parser defect there is never fixed.
  The server would load on them; that is a compatibility fact, not a recommendation.
- **`engines` in `package.json` is a compatibility floor, not a support policy.** It declares
  `"node": ">=18"` because that is the floor `express@5.2.1` itself declares, and the project's
  plan of record fixes that exact value. It records what the code *runs on* and supersedes the
  project's previous 14.x minimum; it does not say what an operator should *deploy on* — the
  two bullets above do. Validated on Node v22.23.2 with npm 10.9.8.
- **npm 7 or newer**, required by `lockfileVersion 3` in the committed lockfile.
- **TCP port 3000 must be free.**

## Install

An install step is now **required before the server can run**. That is new: the project
previously had zero dependencies and needed no install at all.

```bash
npm ci
```

`npm ci` rather than `npm install`: it installs deterministically from the committed
`package-lock.json`, reproducing the identical dependency tree every time.

## Run

```bash
npm start
# or, equivalently
node server.js
```

The server binds **loopback only** — `127.0.0.1:3000`, never every interface — and prints
exactly:

```text
Server running at http://127.0.0.1:3000/
```

## Endpoints

| Method | Path | Status | Content-Type | Body | Bytes |
|--------|------|--------|--------------|------|-------|
| GET | `/` | 200 | `text/plain` | `Hello, World!\n` | 14 |
| GET | `/good-evening` | 200 | `text/plain` | `Good evening\n` | 13 |
| HEAD | `/` | 200 | `text/plain` | (no body, derived from GET) | 14 |
| HEAD | `/good-evening` | 200 | `text/plain` | (no body, derived from GET) | 13 |
| any | any other path | 404 | `text/plain` | `Not Found\n` | 10 |
| any | (unhandled error) | 500 | `text/plain` | `Internal Server Error\n` | 22 |

`Content-Type` is exactly `text/plain` — no charset parameter is ever appended. No
`X-Powered-By` header and no `ETag` header is emitted on any of these responses.

The two paths are matched **exactly as written**: matching is case-sensitive and a trailing
slash is significant, so `/GOOD-EVENING`, `/Good-Evening`, `/good-evening/` and `//` are **not**
aliases — each one is "any other path" and returns the same `404`. The table above is therefore
the complete list of requests that succeed, and it is not a subset of what the server actually
serves.

The byte count in the HEAD rows is the length of the representation each resource *would*
have returned, so `HEAD` reports the same `14` and `13` as the matching `GET` while sending
no body — that is what a HEAD request is for. It is the one header the runtime cannot work
out on this method, because there are no bytes to measure, so the shared emitter sets it
explicitly for HEAD and only for HEAD. A `GET` response is untouched: its headers, their
values and their order are exactly what the pre-Express server emitted.

Quick verification:

```bash
curl -i http://127.0.0.1:3000/
curl -i http://127.0.0.1:3000/good-evening
```

## Tests

```bash
npm test
```

The suite runs on Node's **built-in test runner** (`node --test`) and adds **zero new
dependencies** — there are no `devDependencies` at all. It binds an **ephemeral port**, so it
passes whether or not a server is already listening on port 3000.

The script is `node --test "tests/**/*.test.js"`, and the **runner** expands that quoted glob
itself — an ability the runner gained in Node 21. That is a second, independent reason to stay
on the supported 22.12.0+ line: on an end-of-life Node 18 or 20 the pattern is taken literally,
so no suite is discovered and `npm test` would report success without having run anything.

## Intentional behaviour changes

The previous server had a single catch-all handler that answered every path and every method
with the same response. Introducing a second addressable endpoint required real routing, so
three behaviours changed on purpose:

- `GET /` is **unchanged** — same status, same 14 bytes, same content type, same loopback
  bind, same startup line.
- Requests to **any other path** now return `404` with a `text/plain` body. A catch-all that
  kept returning the Hello response would make a typo such as `/good-evenin` silently
  succeed, leaving the two endpoints indistinguishable from a client error. "Any other path"
  is meant literally: both routers match **case-sensitively** and treat a **trailing slash as
  significant** (`express.Router({ caseSensitive: true, strict: true })`), so a near miss such
  as `/GOOD-EVENING`, `/Good-Evening`, `/good-evening/` or `//` fails exactly like `/nope`
  rather than quietly succeeding through the framework's default, laxer matching.
- **Methods other than GET and HEAD** now return `404`. Only these two read-only methods are
  served; HEAD is derived automatically from GET. `OPTIONS` is included in that rule, on the
  declared paths as well as on every other one: each feature router registers an `OPTIONS`
  handler that declines its own path, which stops the routing engine answering `OPTIONS`
  itself with `200`, an `Allow` list and an `X-Content-Type-Options` header — none of which
  the pre-Express server ever sent — and lets the request fall through to the same
  plain-text `404` as `POST`, `PUT` and `DELETE`.

## Project structure

Each flow and feature owns exactly one module, so every file has a single reason to change:

```text
server.js                          bootstrap flow - bind host/port, log
src/app.js                         composition flow - build app, mount order
src/config/index.js                configuration flow - host, port, media type
src/lib/textResponse.js            response-emission flow - the sole emitter
src/routes/hello.routes.js         Hello feature flow - GET /
src/routes/goodEvening.routes.js   Good-evening feature flow - GET /good-evening
src/middleware/notFound.js         route-miss flow - 404
src/middleware/errorHandler.js     error flow - 500
tests/endpoints.test.js            endpoint contract
tests/regression.test.js           backward-compatibility lock
```

Every response — success, route miss and failure alike — leaves through the single emitter in
`src/lib/textResponse.js`. That one choke point is why `Content-Type` cannot drift.

## Notes

- Configuration is intentionally **hardcoded in source** (`src/config/index.js`) — no
  environment variables and no command-line flags.
- The application is decomposed into one module per flow: configuration, the shared response
  emitter, one router per feature, the route-miss handler, the error sink, and the
  composition root, leaving `server.js` as the bootstrap alone.
- Measured performance profile, disclosed rather than glossed: request latency 3.700 ms →
  3.716 ms mean (a 0.4% difference, against a budget of under 10 ms); startup 29 ms → 81 ms
  (8% of the under-one-second budget); resident memory 53.8 MB → 71.0 MB, an increase of
  about **17.6 MB — the one budget genuinely affected**, and the unavoidable cost of loading
  the framework. The installed dependency tree is 595 files and is git-ignored; the
  repository's own tracked source is about 108 KB across 16 tracked files excluding the three
  binary assets, a third of which is the committed lockfile.
