# Express endpoints — the response contract

This is the contract reference for the two HTTP endpoints this project serves: the
original `GET /`, preserved byte for byte, and the added `GET /good-evening`. It records
what goes out on the wire — status, headers, exact body, byte count — plus every
behaviour that changed when the framework was introduced and the reason each change was
chosen.

The [README](../../README.md) is the quick start: prerequisites, install, run and test
commands live there and are not repeated here. This document is the reference you reach
for when you need to know exactly what a request returns and why.

Every value below was measured against a running server rather than inferred. The
measurements were taken on Node.js 22.x with `express@5.2.1`, using raw-socket captures
for header order and byte counts, and the runtime's own HTTP client for parsed header
sets. The section [Reproducing every number in this document](#reproducing-every-number-in-this-document)
lists the commands, so nothing here has to be taken on trust.

## Response contract

Six response shapes exist in total: two endpoints, their two derived `HEAD` replies, and
the two terminal outcomes. There is no seventh — every request that reaches this server
lands in exactly one of these rows.

| Method | Path | Status | Content-Type | Body (bytes on the wire) | Content-Length |
|--------|------|--------|--------------|--------------------------|----------------|
| GET | `/` | 200 | `text/plain` | `Hello, World!\n` — 14 | 14 |
| HEAD | `/` | 200 | `text/plain` | none — 0, derived from GET | 14 |
| GET | `/good-evening` | 200 | `text/plain` | `Good evening\n` — 13 | 13 |
| HEAD | `/good-evening` | 200 | `text/plain` | none — 0, derived from GET | 13 |
| any | any other path | 404 | `text/plain` | `Not Found\n` — 10 | 10 |
| any | (unhandled error) | 500 | `text/plain` | `Internal Server Error\n` — 22 | 22 |

The four byte counts — 14, 13, 10 and 22 — are part of the contract, and each one
includes the single trailing newline. That newline is invisible in terminal output and
easy to leave out of a hand-written comparison, so it is verified as bytes rather than
eyeballed: the test suite asserts `Buffer.byteLength` alongside the literal, and the
verification commands below pipe each response through a byte dump.

The two literals are exact. `Hello, World!\n` has a capital `H`, a comma, one space, a
capital `W` and an exclamation mark. `Good evening\n` has a capital `G`, one space, and
no comma, exclamation mark or full stop. Neither is padded, wrapped or trimmed anywhere
in the pipeline.

### The `HEAD` rows: no body, but a `Content-Length` that still counts

The two `HEAD` rows are the one place in this table where the body column and the
`Content-Length` column deliberately disagree, so the distinction is worth stating
plainly rather than leaving a reader to reconcile it.

A `HEAD` reply carries **no body at all** — zero bytes on the wire, which is what the
`none — 0` cell records. It still reports `Content-Length: 14` on `/` and
`Content-Length: 13` on `/good-evening`, because that header describes the length of the
representation the request names, not the length of what this particular reply
transmits. Asking for metadata about a 14-byte resource should tell you it is 14 bytes.

That header does not arrive by itself. When a handler writes a body with
`res.end(body)` and the request method is `HEAD`, the runtime discards the body and
omits `Content-Length` entirely — a bare `HEAD` reply from the original single-handler
server carried only `Content-Type`, `Date`, `Connection` and `Keep-Alive`. The shared
emitter therefore sets `Content-Length` explicitly, and only for `HEAD`, from
`Buffer.byteLength(body)`. On a body-bearing reply it sets nothing: the runtime appends
the identical value on its own, which is what keeps the header order identical to the
original server's.

This single header is the only difference between the original server's header block and
this one, anywhere, on any path — and it is an addition made on purpose, not drift. Two
consequences follow, and both are intentional:

- `tests/regression.test.js` asserts **status only** on `HEAD /`. The representation
  length belongs to the emitter rather than to the route, so the backward-compatibility
  lock deliberately does not couple itself to it. Content lengths are asserted on the
  `GET` responses, where they are the route's own contract.
- On `HEAD` the value appears immediately after `Content-Type` rather than last, because
  the emitter sets it before ending the response. Ordering on `HEAD` is not part of the
  contract; ordering on the body-bearing 200 responses is, and it is unchanged.

### `Hello world` is the package description, not a response body

One clarification prevents a documentation error that would otherwise be easy to repeat.
The phrase `Hello world` does appear in this repository, exactly once, as the package
description in `package.json` — `"description": "Hello world in Node.js"`. It has never
been a response body. The literal this server actually writes for `GET /` is
`Hello, World!\n`: capitalised differently, punctuated differently, newline-terminated,
and 14 bytes long. When a request for a change describes the response as "Hello world",
it is quoting the description; the wire format is the table above.

## Response headers

On the body-bearing 200 responses the header block is identical to the one the original
server sent — same names, same values, same order. This was captured on the raw socket
from both servers and compared, not assumed:

```text
HTTP/1.1 200 OK
Content-Type: text/plain
Date: Thu, 30 Jul 2026 23:31:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Content-Length: 14
```

Five headers, in that order, for `/` and `/good-evening` alike, with only the
`Content-Length` value and the volatile `Date` differing between them. Comparing the
header-name sets of the two servers with `Date` excluded returns identical sets.

`Content-Type` is exactly `text/plain`. No charset parameter is appended, on any path,
including the 404 and 500 paths. That exactness is not a convention the handlers agree
to observe — it is enforced structurally by the single emitter described in
[How the flows fit together](#how-the-flows-fit-together).

Four headers are deliberately absent, and each absence is a decision with a mechanism
behind it:

- **No `X-Powered-By`.** The framework advertises itself on every response by default.
  `src/app.js` calls `app.disable('x-powered-by')`, so the header is never written. The
  framework's own security guidance recommends reducing this fingerprint; here it also
  happens to be required for header parity, since the original server never sent it.
- **No `ETag`.** The framework computes a validator over each body by default.
  `src/app.js` calls `app.set('etag', false)`, which removes the header and skips a hash
  over every response — a small performance win as well as a parity one.
- **No `Content-Security-Policy`.**
- **No `X-Content-Type-Options`.**

Those last two are worth naming precisely, because they are what this project is
avoiding rather than something it never had a chance of emitting. They are the headers
the framework's **built-in error page** sends. Left to its own devices, an application
with no terminal handlers answers an unmatched path with a small HTML document — 143
bytes for `GET /nope`, and longer for a longer path, since the page embeds the path it
is reporting — served as `text/html; charset=utf-8` alongside both of those headers. An
unhandled failure produces the same shape with a stack trace inside it, which measured
1,860 bytes here and is inherently variable because it embeds absolute file paths. This
server emits neither page: `text/plain` is the only content type it
has ever produced, and the terminal handlers exist precisely to keep that true on the
failure paths. Both header settings together satisfy requirement F-006-RQ-003, header
and fingerprint parity.

One more header the framework would have added on its own is `Allow`, together with
`X-Content-Type-Options`, on an `OPTIONS` request whose path matches a declared route:
the routing engine answers such a request itself, with 200 and `Allow: GET, HEAD`,
before any handler of this project runs. The engine offers no switch to turn that off,
so `src/middleware/optionsGuard.js` terminates `OPTIONS` ahead of the routers and hands
it to the same plain-text 404 every other unsupported method receives. Measured with the
guard in place, `OPTIONS /` returns 404 with neither header present.

### Why the framework's response helpers are prohibited

This is the most instructive measurement in the whole feature, so it is recorded rather
than summarised. Each row is a real response from `express@5.2.1`:

| Call | Resulting `Content-Type` |
|------|--------------------------|
| `res.send('x\n')` | `text/html; charset=utf-8` |
| `res.type('text/plain').send('x\n')` | `text/plain; charset=utf-8` |
| `res.set('Content-Type','text/plain').send('x\n')` | `text/plain; charset=utf-8` |
| `res.setHeader('Content-Type','text/plain')` then `res.end(body)` | `text/plain` |

Only the last row produces exactly `text/plain`. Set no type and the helper guesses
HTML; set the type through any of the helper's own entry points and a charset parameter
is appended for you. Both outcomes break the requirement that the value be exactly
`text/plain`, so the framework's response helpers are not used anywhere under `src/` —
every response is written with the raw response API instead, which is the same idiom the
original server used.

A related change in this major version reinforces the same discipline: the
two-argument form `res.send(body, status)` was removed, so a status-bearing response has
to set its status before the body is emitted. The shared emitter does exactly that, in
that order, on every path, so the ordering is guaranteed by structure rather than by
each handler remembering it.

## Behavioural deltas, and why each one was chosen

Three things a client can observe changed: `/good-evening` now answers with its own body,
an unmatched path now returns 404, and a method other than `GET` or `HEAD` now returns
404. Everything else a client can observe — the existing response, the bind address, the
port, the startup line, the header block on 200, the process-level failure posture — is
preserved. The register below is the complete list, and it also records the three
project-level changes that are not response behaviour at all: the dependency count, the
new install step, and the raised runtime floor. Anything not in this table did not
change.

| Behaviour | Before | After | Status |
|-----------|--------|-------|--------|
| `GET /` | 200, `Hello, World!\n`, `text/plain`, 14 bytes | Identical | **Preserved** |
| Bind address and port | `127.0.0.1:3000` | Identical | **Preserved** |
| Startup log | `Server running at http://127.0.0.1:3000/` | Identical | **Preserved** |
| Response headers on 200 | no `ETag`, no `X-Powered-By` | Identical | **Preserved** |
| `GET /good-evening` | 200, `Hello, World!\n` from the catch-all | 200, `Good evening\n` | **New capability** |
| `GET /any-other-path` | 200, `Hello, World!\n` | 404, `Not Found\n`, `text/plain` | **Intentional change** (A2) |
| `POST /`, `DELETE /`, other methods | 200, `Hello, World!\n` | 404, `Not Found\n` | **Intentional change** (A3) |
| Dependency count | 0 | 1 direct, 67 in the resolved tree | **Intentional change** |
| Install step before running | none | `npm ci` required | **Intentional change** |
| Runtime floor | Node.js 14.x | Node.js 18 | **Intentional change** |
| Process-level error posture | unhandled, crash on bind failure | Unchanged | **Preserved** |

Every row marked as an intentional change is a documented delta, not a defect and not a
regression. The two that a client can observe are the direct consequence of the server
gaining addressable endpoints — two endpoints cannot coexist while one handler answers
every path identically — and both were measured rather than reasoned about. No
compatibility shim is offered for either of them, because a shim would preserve an
accident rather than a contract.

### A1 — why the path is `/good-evening`

Lowercase kebab-case, derived directly from the response phrase. It cannot collide with
`/`, and it is self-describing, so the contract needs no lookup table mapping opaque
paths to responses. Note that the URL is kebab-case while the module that serves it is
`src/routes/goodEvening.routes.js` in camelCase; the two spellings are independent, and
the URL is the one that is part of the contract.

### A2 — why an unmatched path returns 404 rather than the existing response

The original handler ignored the URL and answered every path with the same body. Keeping
that as a fallback would have made a near miss such as `/good-evenin` look like a
success, which would leave the two endpoints indistinguishable from a client error and
would destroy the determinism the test suite depends on. An undeclared path now fails
loudly instead. The regression risk is nil: the only documented checks against this
server target the root URL, and the integration this repository exists for consumes the
repository as files rather than over HTTP.

Measured examples, all returning 404 with `text/plain` and the 10-byte `Not Found\n`
body: `GET /nope`, `GET /good-evenin`, `GET /any-other-path`.

### A3 — why only `GET` and `HEAD` are served

Two read-only text resources are correctly modelled as `GET`-only, and `HEAD` is derived
from the `GET` handlers automatically without a second registration. Every other method
reaches the same plain-text route-miss reply. Measured: `POST /`, `DELETE /`,
`PUT /good-evening` and `OPTIONS /` all return 404 with the 10-byte body. Preserving the
old behaviour would have meant adding method-agnostic shims to keep `POST /` answering
200 — encoding an accident of the original catch-all as a promise to callers.

### A4 — why the literals are what they are

`Hello, World!\n` is preserved verbatim, all 14 bytes of it, because it is the existing
contract and the three statements that write it were relocated rather than rewritten.
`Good evening\n` is emitted exactly as it was requested, with a single trailing newline
appended so that both endpoints are symmetrical and both byte counts include their
terminator.

## Validation rules

Exactly one validation rule changed.

- **VR-001 is amended.** It previously read "all requests receive HTTP 200". It now
  reads: a request matching a declared route and method receives HTTP 200 with that
  route's exact literal; any other request receives HTTP 404 with a `text/plain` body.
- **VR-002 (body content), VR-003 (content type), VR-004 (loopback bind) and VR-005
  (port 3000) are unchanged**, and each is re-verified as a regression check rather than
  assumed to still hold.

The pre-existing manual checklist is re-run verbatim, and all five items pass unchanged:
the server initializes; the endpoint responds with 200; the body is `Hello, World!\n`;
the `text/plain` header is present; the process binds `127.0.0.1:3000`. The bind item was
confirmed directly — the listening socket reports local address `127.0.0.1`, not
`0.0.0.0`, so the socket is genuinely restricted to loopback rather than merely reachable
there.

Two automated suites hold this tier in place so a future change cannot quietly
reintroduce drift, and both run against an ephemeral port rather than 3000:

- `tests/endpoints.test.js` — the endpoint contract: status, exact content type and exact
  body for both endpoints, the plain-text 404, and the plain-text 500 proven for both
  failure modes.
- `tests/regression.test.js` — the backward-compatibility lock: `Content-Length` exactly
  14 on `/` and 13 on `/good-evening`, the absence of `ETag`, the absence of
  `X-Powered-By`, `HEAD /` returning 200, and both intentional deltas.

## How the flows fit together

Each flow and feature owns exactly one module, so every file has a single reason to
change:

```text
server.js                          bootstrap flow - bind host and port, log
src/app.js                         composition flow - build the app, fix the mount order
src/config/index.js                configuration flow - HOSTNAME, PORT, MEDIA_TYPE
src/lib/textResponse.js            response-emission flow - the sole emitter
src/routes/hello.routes.js         Hello feature flow - GET /
src/routes/goodEvening.routes.js   Good-evening feature flow - GET /good-evening
src/middleware/optionsGuard.js     OPTIONS-suppression flow
src/middleware/notFound.js         route-miss flow - 404
src/middleware/errorHandler.js     error flow - 500
```

That decomposition is not invented for this project. The framework's own routing
documentation presents its router class as the mechanism for building modular, mountable
route handlers — each router instance being a complete middleware and routing system in
its own right — and demonstrates defining a router in its own module file and mounting it
on the application. One router module per feature is the idiomatic expression of that
guidance.

### One choke point, and why the content type cannot drift

Every response leaves through a single function, `sendText(res, statusCode, body)` in
`src/lib/textResponse.js` — the two endpoints, the route miss and the error sink alike.
Its core is the three statements from the original handler, relocated rather than
rewritten:

```javascript
res.statusCode = statusCode;
res.setHeader('Content-Type', MEDIA_TYPE);
res.end(body);
```

Relocation rather than rewriting is what makes the parity claim in this document provable
instead of aspirational: the bytes that produced the original response are the same bytes
producing it now. And because there is exactly one place in the codebase permitted to
write a response header or body, `Content-Type` cannot drift to `text/html` or acquire a
charset parameter no matter how a future handler is written. A handler that wanted to get
it wrong would have to stop using the emitter first.

The emitter sets `Content-Type` on every path and `Content-Length` only for `HEAD`, for
the reason given under the contract table. On a body-bearing reply the runtime supplies
`Content-Length` itself from the body it is given, so the value is never computed twice
and never set by hand.

### The mount order is load-bearing

`src/app.js` mounts the pipeline in this order, and every way of getting it wrong is
silent — the application still starts and still answers requests:

1. `optionsGuard` — must run **before** the routers, because the routing engine answers a
   matching `OPTIONS` request itself, from its own terminator, complete with `Allow` and
   `X-Content-Type-Options`. Mounted after the routers it never sees the request.
2. `hello.routes` — `GET /`.
3. `goodEvening.routes` — `GET /good-evening`.
4. `notFound` — the route miss. Mounted **before** the routers it swallows every request
   and both endpoints degrade to 404.
5. `errorHandler` — must stay **last**. The framework recognises an error handler by its
   four-parameter arity and treats only the final one as terminal; anywhere else, a
   failure escapes to the built-in HTML error page.

One further mount point exists between steps 3 and 5, for the optional extra middleware
described under [the factory](#the-factory-returns-an-unbound-application). The running
server supplies none, so its pipeline is exactly the five steps above.

### The route miss is path-less middleware, never a wildcard

`notFound` is mounted as `app.use(notFound)` with one argument and no path pattern. It
runs only after both routers decline, which is exactly the semantics required, and it is
cheaper than a route because no path pattern is compiled at all.

Writing it as a wildcard route would not merely be slower — it does not start. This major
version requires wildcards to be named, and the older idioms throw during registration:

```text
app.get('/*', handler)  -> Missing parameter name at index 2: /*
app.all('*', handler)   -> Missing parameter name at index 1: *
app.use('*', handler)   -> Missing parameter name at index 1: *
```

The named form `'/*splat'` registers cleanly, but there is no reason to reach for it here
when path-less middleware is both correct and cheaper.

### The error sink is four parameters and a guard

```javascript
if (res.headersSent) return next(err);
sendText(res, 500, INTERNAL_ERROR_BODY);
```

All four parameters — error, request, response, next — are mandatory, because arity is
how the framework identifies error middleware; a three-parameter function is treated as
ordinary middleware and never receives the error. The `headersSent` guard covers the case
where a response was already partly written: there is nothing left to say on that socket,
so the error is passed on rather than written over.

This sink absorbs both failure modes. A synchronous throw reaches it the usual way, and
this major version also forwards a **rejected promise** returned from a handler to error
middleware automatically. Both were exercised against the real pipeline and both produce
the identical reply: 500, `text/plain`, the 22-byte `Internal Server Error\n`. That is
the mechanism by which no failure path can emit the framework's HTML page.

### The factory returns an unbound application

`src/app.js` exports a bare `createApp()` factory. It configures and mounts everything
and then hands the application back **without calling `listen`** — it opens no socket and
chooses no address. Binding belongs to the bootstrap alone, and the separation is what
lets both test suites drive this exact pipeline in-process on an ephemeral port,
`listen(0, '127.0.0.1')`, so `npm test` passes whether or not something is already
listening on port 3000.

The factory also accepts an optional array of extra middleware, mounted after both
feature routers and before the terminal pair. The running server passes nothing and its
pipeline is unchanged; the seam exists because mounting only ever appends, so a flow
added to an already-composed application would sit behind the route miss and never run —
which would make the 500 contract impossible to exercise against the real pipeline.

### The host argument to `listen` is mandatory

`server.js` calls `createApp().listen(PORT, HOSTNAME)`. Passing the host is not
decoration: the framework's canonical starter form takes the port alone and therefore
binds **every interface**. Dropping the host argument would silently expose a server
whose isolation is its primary security control, while every functional test kept
passing. This is the one deliberate and important deviation from the framework's minimal
starter application.

The startup line is printed from the socket's own `listening` event rather than from a
callback handed to `listen`, and that too is deliberate. The framework installs a `listen`
callback as the socket's error listener as well, which would turn a failed bind into a
handled event: the address-in-use error would be swallowed, the success line would print
anyway, and the process would exit reporting success. Logging from `listening` keeps the
message success-only and leaves the failure path unhandled, so a bad bind still crashes
loudly. The message itself is unchanged: `Server running at http://127.0.0.1:3000/`.

## Performance, measured

Adding a framework to a server that previously had no dependencies has a cost. It is
disclosed here with numbers rather than asserted away, because "performance is not
impacted" is not a claim anyone should accept without them.

Two independent measurement runs are reported. The reference column is the measurement
taken when this change was planned, and it is the figure the README also publishes. The
second column is an independent re-measurement of the same comparisons on the Windows
host this document was written on. Absolute figures depend on the machine, the runtime
build and what else it is doing; the direction and the scale reproduce, and both runs sit
comfortably inside every budget.

| Budget | Reference run: before → after | This host: before → after | Verdict |
|--------|-------------------------------|---------------------------|---------|
| Response latency, under 10 ms | 3.700 ms → 3.716 ms mean, 200 sequential requests — a 0.4% difference, inside measurement noise | 0.122 ms → 0.256 ms mean, 200 sequential requests | **Pass** — 2.7 times inside the budget on the reference run, about 39 times inside it here |
| Startup, under 1 second | 29 ms → 81 ms, about 8% of the budget | about 47 ms → about 200 ms, three runs each | **Pass** — more than fivefold headroom on the slower of the two runs |
| Response size | 14 bytes → 14 bytes on `/` | identical; 13 bytes on `/good-evening` | **Pass** — unchanged on the existing route |
| Resident memory | 53.8 MB → 71.0 MB, an increase of about **17.6 MB** | 31.7 MiB → 44.3 MiB, an increase of about 12.6 MiB | **Disclosed increase** — the one budget genuinely affected |
| Repository disk footprint | source under 1 MB | tracked source, excluding the pre-existing binary assets, is about 72 KB | **Pass** — the installed tree is excluded from version control |

The memory figure is the honest one to dwell on. It is the **unavoidable cost of loading
the framework that was asked for**, and no amount of code discipline removes it: the
increase is the framework and its 66 transitive packages being read, parsed and held in
memory. Every mitigation available without contradicting the request has already been
applied, and the residual is what is left. Note also that an older record of a "~30 MB
baseline" for this project is stale — on a current runtime the original server measured
53.8 MB in the reference run and 31.7 MiB on this host, before any change was made.

### Safeguards applied

- **Response literals are hoisted to module-scope constants**, so no string is allocated
  per request; each body is created once when its module is loaded.
- **No body parser is mounted.** A request body is never buffered, decoded or even looked
  at, which keeps the request-processing surface as small as it was.
- **`ETag` generation is disabled**, which skips a hash over every response body — and
  restores header parity at the same time.
- **Exactly two routes are registered**, so the matcher compiles two static patterns once
  at startup and route lookup stays trivial.
- **Handlers perform constant-time synchronous writes** with zero I/O, zero awaits and no
  computation: set status, set one header, end with a constant.

### Deliberately declined

Each item below is recommended somewhere in the framework's own performance or security
guidance, was weighed against this project, and was **not adopted**. None of them is in
the running server.

- **Compression** — for 13- and 14-byte bodies it would cost CPU and *add* bytes.
- **Logging middleware** — the preserved startup line is the whole logging surface.
- **Helmet** — it targets an external-facing threat model this loopback-only server does
  not have, and it would add a dependency; loopback binding remains the security control.
- **Clustering** — a single process is the correct shape for two static text resources.
- **Caching** — there is nothing to cache; both bodies are already constants in memory.
- **Load balancing** — there is one instance, reachable only from this machine.
- **Reverse proxying** — nothing to terminate, no static assets to serve and no fan-out
  to arrange in front of a single loopback process.
- **Process managers** — a failed bind should crash loudly and visibly, not be restarted
  around.

Declining all eight is what holds the direct dependency count at exactly one.

### Reproducibility and dependency integrity

- The resolved tree is **67 packages** — the framework plus 66 transitive dependencies —
  every one of them a production package, with no development or optional entries.
- `package-lock.json` is committed at `lockfileVersion 3`, so `npm ci` reproduces that
  identical tree rather than re-resolving it.
- `express@5.2.1` is **MIT** licensed, declares an engine floor of **`node >= 18`**, and
  brings **28** direct dependencies of its own.
- `npm audit --omit=dev` on this exact tree reports **0 vulnerabilities**.
- `npm ls --depth=0` reports `express@5.2.1` as the sole direct dependency.
- The installed tree is **595 files** — 65 packages at the top level plus two nested
  duplicate copies, which is the 67 entries the lockfile records. That is about 2.1 MB of
  file content and roughly 4 MB of actual disk once filesystem block allocation is
  counted. It is excluded from version control, which is why the repository's own tracked
  source stays tiny.

## Rules, and the decisions retained or superseded

Two user-specified rules apply to this project. Their full text lives in the project's
rules document, which is the authoritative source; what follows is a summary of what each
requires and how this feature answers it.

**Rule 1, "QA-rules-02-june", has an empty body.** It is present and it counts among the
two applicable rules, but it carries no directive, no constraint, no coding standard and
no required artifact. Nothing in this document or this feature traces to it, and nothing
has been inferred from its name. Because it supplies no directive, the work is instead
held to ordinary professional documentation practice: every number published here was
verified against live output, deltas are disclosed rather than hidden, and no content was
invented to fill a gap.

**Rule 2, "Ajit_New Product", has three clauses.** Two are honoured in full and one is
deliberately set aside.

- **Its language clause is set aside, explicitly rather than silently.** The rule opens by
  naming a different implementation language for a new product; this feature is
  implemented in JavaScript on Node.js with `express@5.2.1`. Four grounds support that
  decision. First, the request that drove this work is the specific, current instruction,
  and it names both the framework to add and the existing artifact to add it to — "this is
  a tutorial of node js server". Second, the rule's own title scopes it to **new product**
  creation, whereas this is a feature added to a committed codebase. Third, literal
  compliance would mean rewriting the server in another language and deleting the very
  endpoint the request asked to keep — "add **another** endpoint" — and a resolution that
  breaks the requirement it exists to serve is not a resolution. Fourth, this repository
  contains no runtime, manifest or source file for that language anywhere; the tracked
  inventory is JavaScript, Java, JSON, Markdown and three binary assets, so there is no
  foundation to build on and no convention to follow.
- **Its separation clause is honoured, two ways.** Structurally, this document lives under
  `docs/features/` — one document per feature area. In content, the contract table above
  carries exactly one row per endpoint. The same directive is why the implementation is
  seven small modules plus a bootstrap rather than one edited file: `src/config/index.js`,
  `src/lib/textResponse.js`, `src/routes/hello.routes.js`,
  `src/routes/goodEvening.routes.js`, `src/middleware/notFound.js`,
  `src/middleware/errorHandler.js` and `src/app.js`, with `server.js` reduced to the
  bootstrap flow alone. A minimal reading of the request could have been satisfied by
  editing `server.js` and registering two routes in it; those modules exist because of
  this clause. `src/middleware/optionsGuard.js` joined them for the header-parity reason
  given above, and it follows the same one-module-one-flow rule.
- **Its performance clause is honoured and measured**, which is why the performance
  section above reports numbers — including the resident-memory increase — instead of
  claiming no impact.

### Architecture decisions retained

- **Loopback-only binding: honoured, and actively defended.** The socket binds
  `127.0.0.1` and the listening socket was verified to report exactly that rather than
  `0.0.0.0`. The framework's canonical starter form would have bound every interface, so
  preserving this took an affirmative act rather than restraint.
- **Hardcoded configuration: honoured.** The host, port and media type are consolidated
  into `src/config/index.js` but remain source literals. There is nothing to configure at
  run time and nothing to pass on the command line; consolidating them removed the
  duplication hazard without externalising anything.
- **No error-handling implementation: partially superseded.** The process-level posture is
  unchanged — a bind failure such as an address already in use, an unavailable address, or
  an out-of-memory condition still crashes the process, and no process-level handler is
  registered. No `try`/`catch` is scattered through the handlers either. The only
  error-handling code added anywhere is the pair of terminal middleware, whose sole purpose
  is to guarantee that no response path can emit the framework's HTML error page.

### Prior-state statements this feature supersedes

Earlier project documentation described a server with no dependencies and no routing, and
in several places prohibited exactly what this feature adds: an outright ban on external
HTTP frameworks, a zero-external-dependencies requirement, a recorded decision rejecting
a framework application, an exclusion of routing from scope, and governance statements to
the effect that the project was static and should not be modified. Those statements
accurately described the project's prior state. They are superseded by the explicit
current instruction to add the framework and a second endpoint — a specific, current
instruction outranks prior-state governance prose — and they are listed here so that the
supersession is on the record rather than a surprise. Route parameters and query-string
handling do remain out of scope. Both original README lines are preserved verbatim in the
README rather than deleted, so the governance statement survives in the record too.

Worth noting on the framework ban specifically: the raw response API is still what writes
every response. The framework supplies routing and composition; the response-writing idiom
is the original one, moved into the emitter.

## Reproducing every number in this document

With a server already running — see the [README](../../README.md) for how to start one —
these commands reproduce the contract, the header claims and the byte counts. The byte
dumps matter: they are how the trailing newline is verified as a byte rather than assumed
from a string comparison.

```bash
# Status, headers and body for each endpoint
curl -i http://127.0.0.1:3000/
curl -i http://127.0.0.1:3000/good-evening
curl -i http://127.0.0.1:3000/nope

# Bodies as bytes, trailing newline included
curl -s http://127.0.0.1:3000/ | od -c
curl -s http://127.0.0.1:3000/good-evening | od -c

# Exactly text/plain, with no charset parameter
curl -sI http://127.0.0.1:3000/ | grep -i '^content-type'

# No framework fingerprint and no validator header
curl -sI http://127.0.0.1:3000/ | grep -ci -e x-powered-by -e etag

# HEAD carries no body and still reports the representation length
curl -sI http://127.0.0.1:3000/ | grep -i '^content-length'

# The documented deltas: each of these is 404
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:3000/
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE http://127.0.0.1:3000/
curl -s -o /dev/null -w '%{http_code}\n' -X OPTIONS http://127.0.0.1:3000/
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/good-evenin

# The four byte counts, independently of the server
printf 'Hello, World!\n'         | wc -c   # 14
printf 'Good evening\n'          | wc -c   # 13
printf 'Not Found\n'             | wc -c   # 10
printf 'Internal Server Error\n' | wc -c   # 22

# Dependency integrity
npm ls --depth=0
npm audit --omit=dev
```

The 500 path is the one row of the contract table that cannot be reached by asking the
running server for it, because both endpoints write a constant string with no I/O and
nothing to fail on. It is exercised instead by `tests/endpoints.test.js`, which passes
deliberately failing middleware to the factory so the error sink has something real to
answer, and asserts the identical 500 reply for a synchronous throw and for a rejected
promise. Run the whole suite with the test command in the
[README](../../README.md).
