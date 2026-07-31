# Express endpoints — contract reference

This document is the authoritative contract for the two HTTP endpoints this project serves:
the pre-existing `GET /`, preserved byte for byte, and the newly added `GET /good-evening`.
It records exact statuses, exact media types, exact bodies with byte counts, the response
header block, the failure paths, and every behaviour that changed when the server moved from
a single core-`http` request handler onto the Express application framework.

The [`README.md`](../../README.md) is the quick start — prerequisites, install, run, test. It
is not repeated here. This page is the contract.

Every value below was measured against the running server rather than inferred: statuses and
byte counts with `curl` and with the runtime's own HTTP client, the header block from a raw
socket read, and the bodies from a byte dump so that trailing newlines are visible.

## The complete observable contract

| Method | Path | Status | Content-Type | Body | Content-Length |
|--------|------|--------|--------------|------|----------------|
| GET | `/` | 200 | `text/plain` | `Hello, World!\n` | 14 |
| HEAD | `/` | 200 | `text/plain` | (no body, derived from GET) | 14 (see note) |
| GET | `/good-evening` | 200 | `text/plain` | `Good evening\n` | 13 |
| HEAD | `/good-evening` | 200 | `text/plain` | (no body, derived from GET) | 13 (see note) |
| any | any other path | 404 | `text/plain` | `Not Found\n` | 10 |
| any | (unhandled error) | 500 | `text/plain` | `Internal Server Error\n` | 22 |

The four byte counts are exact and were verified two independent ways — from the wire, and by
measuring the literals themselves:

```text
GET /              -> 14 bytes  48 65 6c 6c 6f 2c 20 57 6f 72 6c 64 21 0a
GET /good-evening  -> 13 bytes  47 6f 6f 64 20 65 76 65 6e 69 6e 67 0a
GET /nope          -> 10 bytes  4e 6f 74 20 46 6f 75 6e 64 0a
error path         -> 22 bytes  'Internal Server Error\n'
```

The trailing `0a` on each body is part of the contract, and it is invisible to a naive string
comparison — which is why it is verified as bytes.

### Path matching is exact, so the table above is the whole successful surface

`any other path` in that table is meant literally. Both feature routers are constructed as
`express.Router({ caseSensitive: true, strict: true })`, which makes **case significant** and a
**trailing slash significant**. Without those two options the framework's default matching is
laxer than the contract: case is folded and a trailing slash is optional, so a set of aliases
nobody declared would answer `200` and look indistinguishable from the documented paths.
Measured on the running pipeline:

```text
GET/HEAD /                 -> 200   (declared)
GET/HEAD /good-evening     -> 200   (declared)
GET/HEAD //                -> 404, text/plain, 'Not Found\n'
GET/HEAD /good-evening/    -> 404, text/plain, 'Not Found\n'
GET/HEAD /GOOD-EVENING     -> 404, text/plain, 'Not Found\n'
GET/HEAD /Good-Evening     -> 404, text/plain, 'Not Found\n'
GET/HEAD /good-evenin      -> 404, text/plain, 'Not Found\n'
```

The effect is that the documented surface and the effective surface are the same set rather than
the documentation describing a subset of what is really served — which matters more than the
current bodies do. Both responses here are constant public text, so nothing is disclosed by an
alias today; but an undeclared way in is a path that any later route-specific rule would simply
not be written for. `tests/regression.test.js` locks all four aliases for **both** GET and HEAD,
because HEAD is derived from the same route and an alias would otherwise resurface on both
methods at once.

### Why the HEAD rows report 14 and 13 with no body

`Content-Length` on a HEAD reply is the length of the representation the resource *would*
have returned, not a count of bytes on the wire — asking for a resource's metadata without
its body is the entire purpose of the method. So `HEAD /` reports the same `14` as `GET /`,
and `HEAD /good-evening` the same `13`, while neither sends a byte of body.

It is the one header the runtime cannot work out on this method. Node strips the body for a
HEAD request, so `res.end(body)` gives it nothing to measure and it emits no
`Content-Length` at all unless one is set explicitly. The shared emitter therefore sets it
for HEAD, and only for HEAD. Measured on the running server from a raw socket, so both
presence and ordering are visible:

```text
GET  /              -> Content-Type: text/plain, Date, Connection: keep-alive, Keep-Alive: timeout=5, Content-Length: 14
HEAD /              -> Content-Type: text/plain, Content-Length: 14, Date, Connection: keep-alive, Keep-Alive: timeout=5
HEAD /good-evening  -> Content-Type: text/plain, Content-Length: 13, Date, Connection: keep-alive, Keep-Alive: timeout=5
```

Two consequences of confining that to one branch are worth spelling out. A `GET` response is
**untouched** — the same header names, the same values and the same order the pre-Express
server produced, with `Content-Length` appended last by the runtime rather than set by hand.
And on `HEAD` the value is measured from the very constant the matching `GET` would have
sent, so the two methods cannot disagree about the size of the resource: there is one
literal per route and one emitter reading it.

`tests/regression.test.js` locks this: it asserts `HEAD /` and `HEAD /good-evening` return
status `200` **and** report `Content-Length` `14` and `13`, so removing the branch fails the
suite instead of silently degrading both routes to a reply that reports no length at all.

### A note on `Hello world`

The phrase `Hello world` appears in this repository exactly once, and not in the response
path: it is the package description, `"description": "Hello world in Node.js"`. The wire
literal for the root route is `Hello, World!\n` — capital `H`, comma, single space, capital
`W`, exclamation mark, single trailing newline, 14 bytes. The description is recorded here
only to explain where the shorter phrasing comes from; it is not a response body.

## Response headers

On a body-bearing response the full header block is identical to the pre-Express server's, in
the same order, measured from a raw socket read:

```text
HTTP/1.1 200 OK
Content-Type: text/plain
Date: (volatile)
Connection: keep-alive
Keep-Alive: timeout=5
Content-Length: 14 on /, 13 on /good-evening
```

`Content-Type` is exactly `text/plain`, with **no charset parameter**. On every response in
the contract table above — success, route miss and error alike — there is:

- **no `X-Powered-By`**, suppressed by `app.disable('x-powered-by')` in `src/app.js`;
- **no `ETag`**, generation turned off by `app.set('etag', false)` in `src/app.js`;
- **no `Content-Security-Policy`**;
- **no `X-Content-Type-Options`**.

The last two are the headers the framework's default HTML error page would have emitted on
the 404 and 500 paths, alongside a `text/html` body this system has never produced. Both
terminal handlers deliberately override that default, which is why neither header nor that
media type can appear. A header-name set comparison against the baseline server, excluding
the volatile `Date` value, reports identical sets on every body-bearing response. Together
these satisfy the header and fingerprint parity requirement.

`HEAD` is the single documented departure, and it adds nothing to the fingerprint: the
representation length the contract requires is stated explicitly there, because a reply with
no body gives the runtime nothing to measure. See "Why the HEAD rows report 14 and 13 with no
body" above.

### Why the framework's response helpers are prohibited

Measured on `express@5.2.1`:

| Call | Resulting `Content-Type` |
|---|---|
| `res.send(body)` | `text/html; charset=utf-8` |
| `res.type('text/plain').send(body)` | `text/plain; charset=utf-8` |
| `res.set('Content-Type', 'text/plain').send(body)` | `text/plain; charset=utf-8` |
| `res.setHeader('Content-Type', 'text/plain')` + `res.end(body)` | **`text/plain`** |

Only the raw `setHeader` + `end` pair yields exactly `text/plain`. Every convenience helper
either appends a charset parameter or, with no type set, picks HTML. That is why no module
under `src/` calls `res.send`, `res.json`, `res.type`, `res.set`, `res.status`, `res.render`
or `res.sendFile`, and why every response is funnelled through the single emitter described
below.

Relatedly, this major line of the framework removed the two-argument `res.send(body, status)`
form, so the status has to be set before the body is emitted. The shared emitter guarantees
that ordering structurally rather than by convention.

## Behavioural deltas

Three behaviours changed. Each is an intentional, documented consequence of introducing
addressable endpoints — not a defect, and not something to be shimmed back.

| Behaviour | Baseline | After | Status |
|---|---|---|---|
| `GET /` | 200, `Hello, World!\n`, `text/plain`, 14 bytes | Identical | **Preserved** |
| Bind address and port | `127.0.0.1:3000` | Identical | **Preserved** |
| Startup log | `Server running at http://127.0.0.1:3000/` | Identical | **Preserved** |
| Response headers on 200 | no `ETag`, no `X-Powered-By` | Identical | **Preserved** |
| `GET /good-evening` | 200, `Hello, World!\n` (catch-all) | 200, `Good evening\n` | **New capability** |
| `GET /any-other-path` | 200, `Hello, World!\n` | 404, `Not Found\n`, `text/plain` | **Intentional change** |
| `POST /`, `DELETE /`, other methods | 200, `Hello, World!\n` | 404, `Not Found\n` | **Intentional change** |
| Dependency count | 0 | 1 direct, 67 in the resolved tree | **Intentional change** |
| Install step before running | none | `npm ci` required | **Intentional change** |
| Runtime floor | Node 14.x | `engines` declares `>=18` (compatibility); Node **22.12.0+** is the supported runtime | **Intentional change** |
| Process-level error posture | unhandled, crash on bind failure | Unchanged | **Preserved** |

### The adjudicated decisions behind them

**Path naming.** `GET /good-evening` is lowercase kebab-case derived directly from the
response phrase. It cannot collide with `/`, and it is self-documenting, so the contract needs
no lookup table. Note the URL is kebab-case while the module that owns it is camelCase
(`src/routes/goodEvening.routes.js`); the two are not the same string. The spelling is also the
*only* accepted spelling: matching is case-sensitive and trailing-slash-strict, so
`/GOOD-EVENING` and `/good-evening/` are route misses rather than aliases — see "Path matching is
exact" above.

**Unmatched paths return 404, not the Hello response.** A catch-all that kept answering with
Hello would make a typo such as `/good-evenin` silently succeed, rendering the two endpoints
indistinguishable from a client error and destroying test determinism. The regression risk is
nil: the only documented HTTP checks target the root URL, and the repository's other consumer
reads files rather than making requests. Measured: `GET /nope` and `GET /good-evenin` both
return `404` with the 10-byte plain-text body.

**Non-GET methods return 404.** Two read-only text resources are correctly modelled as
GET-only, and HEAD is derived automatically from the GET handlers. Preserving `POST /`
returning 200 would have meant encoding an accident of the original catch-all as a contract.
Measured: `POST /` and `DELETE /` both return `404` with the 10-byte plain-text body.

**Response literals.** `Hello, World!\n` is preserved verbatim at 14 bytes. `Good evening\n`
is emitted exactly as requested, with one trailing newline appended for symmetry with the
existing literal, at 13 bytes.

### OPTIONS: suppressed at the route, not left to the engine

`OPTIONS` is the one unsupported method the routing engine will answer *by itself*. On any path
it can match, it replies `200` with an `Allow` list and an `X-Content-Type-Options: nosniff`
header, written from the router's own terminator before this project's handlers ever run — two
headers the pre-Express server never sent, on a method this system does not serve.

The engine exposes no setting to switch that off; its router accepts only case-sensitivity,
parameter-merging and strict-routing options — two of which this project does set, for the
exact-path matching described above, and neither of which touches `OPTIONS`. Suppression
therefore happens where the method contract belongs: **each feature router registers an
`OPTIONS` handler on its own route that
simply declines**, calling `next()` without writing anything. With an `OPTIONS` handler present
the router has nothing to advertise, so it generates no automatic reply, and the request falls
through to the single route-miss flow like every other unsupported method.

Measured on the running server:

```text
OPTIONS /              -> 404, text/plain, 'Not Found\n' (10 bytes), no Allow, no X-Content-Type-Options
OPTIONS /good-evening  -> 404, text/plain, 'Not Found\n' (10 bytes), no Allow, no X-Content-Type-Options
OPTIONS /nope          -> 404, text/plain, 'Not Found\n' (10 bytes)
```

So the "any other path returns 404" row holds for `OPTIONS` exactly as it does for every other
method, on the declared paths as well as everywhere else, and the header block stays identical
to the baseline's on every one of them.

Two structural points make this the right place for it. Keeping the declination inside the
route module leaves each path's method contract with the feature that owns it, and it costs the
pipeline nothing: the composition root stays at exactly four mounted flows, so no extra stage
is added for every request to walk through. `tests/regression.test.js` locks the behaviour in
for both declared paths, asserting the `404`, the exact `text/plain` body, and the absence of
both `Allow` and `X-Content-Type-Options`.

## Validation rules

Exactly one validation rule changed:

- **VR-001** — previously *all requests receive HTTP 200* — now reads: a request matching a
  declared route and method receives HTTP 200 with that route's exact literal; any other
  request receives HTTP 404 with a `text/plain` body.

Four are unchanged and are re-verified as regression checks:

- **VR-002** body content — the exact literals above.
- **VR-003** content type — exactly `text/plain`.
- **VR-004** loopback bind — the socket listens on `127.0.0.1` only.
- **VR-005** port — 3000.

The pre-existing manual checklist is re-run verbatim and all five items pass unchanged: the
server initializes; the endpoint responds with 200; the body is `Hello, World!\n`; the
`text/plain` header is present; the process binds `127.0.0.1:3000`. On the bind check, the
listening socket's local address was read directly and reports `127.0.0.1:3000` rather than a
wildcard address, so loopback isolation is measured rather than assumed.

`tests/regression.test.js` exists specifically to hold this tier in place — the exact content
lengths on GET, the absence of both added headers, the HEAD status together with its
representation lengths of `14` and `13`, and both 404 deltas — so a future change cannot
quietly reintroduce drift.

## Architecture

### The choke point

Every response — success, route miss and error alike — leaves through one function,
`sendText(res, statusCode, body)` in `src/lib/textResponse.js`, built on the three statements
relocated verbatim from the pre-Express handler:

```javascript
res.statusCode = statusCode;
res.setHeader('Content-Type', MEDIA_TYPE);
res.end(body);
```

That single choke point is why the content type cannot drift, and it is the structural reason
the parity claim above holds rather than depending on each handler being written carefully.
`Content-Type` is the only header set unconditionally: on a body-bearing reply
`Content-Length` arrives free from the runtime's `res.end` and is never set by hand, which is
what keeps the `GET` header block and its ordering identical to the baseline's. The single
exception is the HEAD branch described above — the one case where the runtime has no bytes to
measure and the representation length has to be stated explicitly.

Relocation rather than rewriting is what makes byte-exact parity provable: the statements were
moved, not retyped.

### The load-bearing mount order

`src/app.js` is the only composition root, and it mounts exactly four flows:

```text
1. hello router          src/routes/hello.routes.js
2. goodEvening router    src/routes/goodEvening.routes.js
3. notFound              src/middleware/notFound.js
4. errorHandler          src/middleware/errorHandler.js   <- must be last
```

Both ordering constraints fail **silently** — the application still starts and still answers:

- mount `notFound` before the routers and it swallows every request, so **both endpoints
  return 404**;
- mount anything after `errorHandler` and the framework stops treating it as the terminal
  error sink, so failures **fall through to the default HTML error page**.

The factory takes **no arguments** and returns an **unbound** application: it never calls
`listen`. That is what lets the test suites drive the very same pipeline in-process on an
ephemeral port instead of requiring port 3000 to be free, and it keeps the pipeline's shape a
contract rather than a parameter.

### The route-miss flow is path-less middleware, never a wildcard

`notFound` is mounted as `app.use(notFound)` with no path argument. It is deliberately not a
wildcard route, because this major line's matcher requires wildcards to be named and throws at
startup on a bare one. Measured:

```text
app.get('/*', handler)  -> Missing parameter name at index 2: /*
app.all('*', handler)   -> Missing parameter name at index 1: *
```

Path-less middleware is both correct here and cheaper — but the saving is **per request, not at
startup**. The router still compiles a matcher for every layer as it is constructed, including
this one. What a path-less, non-terminally-mounted layer gets is a root fast path that matches
without running that matcher on each request.

### The error sink

`errorHandler` is a four-parameter terminal handler — the framework identifies error
middleware by arity, so all four parameters are mandatory even though the last can look
unused — with a headers-sent guard:

```javascript
if (res.headersSent) return next(err);
sendText(res, 500, INTERNAL_ERROR_BODY);
```

This major line forwards **rejected promises** to error middleware automatically, so the sink
absorbs both a synchronous throw and a rejected promise, and no failure path can emit default
HTML. `tests/endpoints.test.js` proves **both failure modes without making either endpoint
fail**: neither declared route can be driven into the sink, because each one writes a constant
string with no I/O and nothing to throw on. The suite instead builds a **test-local fixture**
that mounts two deliberately failing flows — one returning a rejected promise on
`/rejected-promise`, one throwing synchronously on `/thrown-error` — ahead of the **real**
`notFound` and `errorHandler` modules, the same objects the running server mounts. So the
assertions are about this project's terminal pair rather than a stand-in, while the scaffolding
stays on the test side of the boundary instead of widening the production factory: `createApp()`
takes no arguments and composes one fixed pipeline, and that is part of the contract.

### The bootstrap passes the host explicitly

`server.js` retains only the bootstrap flow, and it passes the hostname to `listen` alongside
the port. This is the most important deliberate deviation from the framework's canonical
minimal application: the canonical starter form takes the port alone and therefore binds every
interface, which would silently destroy the loopback isolation that is this system's primary
security control. The hostname argument is **mandatory**.

The startup line is logged from the socket's own `listening` event rather than from a `listen`
callback, because the framework installs any such callback as the socket's error listener too —
which would turn a failed bind into a handled event, print a success message and exit
reporting success. Keeping the message success-only leaves a bad bind fatal, unchanged from the
baseline.

### Module map

```text
server.js                          -> bootstrap flow: bind and log, nothing else
src/app.js                         -> composition flow: the four mounts and two settings
src/config/index.js                -> configuration flow: HOSTNAME, PORT, MEDIA_TYPE
src/lib/textResponse.js            -> response-emission flow: sendText, the sole emitter
src/routes/hello.routes.js         -> Hello feature flow: GET /
src/routes/goodEvening.routes.js   -> Good-evening feature flow: GET /good-evening
src/middleware/notFound.js         -> route-miss flow: 404
src/middleware/errorHandler.js     -> error flow: 500
```

### Retained and superseded decisions

Retained, and honored in full:

- **Loopback-only binding** — preserved and actively defended against a framework default that
  would have broken it.
- **Hardcoded configuration** — consolidated into one module, but still literal in source: no
  environment variables, no configuration file, no command-line parsing.

Partially superseded:

- **No error-handling implementation** — the process-level posture is *unchanged*: an address
  already in use, an unavailable address, or an out-of-memory condition remains unhandled and
  still crashes the process. No `try`/`catch` is scattered through handlers and no
  process-level handlers are registered. The only addition is the two terminal middleware,
  whose sole purpose is to guarantee that no response path can emit the framework's default
  HTML.

Superseded by the explicit current instruction to adopt the framework, and listed so that no
later reader restores them by mistake: the prohibition on external HTTP frameworks; the
zero-external-dependencies requirement and the architecture decision behind it; the earlier
rejection of an Express application; the routing exclusion, which a second addressable
endpoint makes impossible to keep (route parameters and query-string handling do remain out of
scope); and the *zero modifications allowed* / *Do not touch!* governance statements. Note that
the raw response API is still used inside the emitter, so the response-writing idiom itself is
unchanged — merely relocated.

## Performance

The applicable rule requires that performance not be impacted, so the numbers are disclosed
rather than asserted. Measured during planning on the reference toolchain, baseline server
versus this implementation:

| Budget | Baseline | After | Verdict |
|---|---|---|---|
| Startup under 1 second | 29 ms | 81 ms | Pass — 8% of budget, more than tenfold headroom |
| Response latency under 10 ms | 3.700 ms mean | 3.716 ms mean | Pass — 0.4% difference, inside noise |
| Response size | 14 bytes | 14 on `/`, 13 on `/good-evening` | Pass — unchanged on the existing route |
| Resident memory | 53.8 MB | 71.0 MB | **Disclosed increase of about 17.6 MB** |

Resident memory is **the one budget genuinely affected**. Every mitigation available without
contradicting the request has already been applied, and the residual increase is the
unavoidable cost of loading the framework itself — no amount of code discipline removes it.
Note also that an earlier recorded *~30 MB baseline* figure is stale: the baseline server
measured 53.8 MB on the current runtime before any change was made.

Re-measured on the Windows validation host used for this checkpoint (Node v22.23.2), running the
same comparison — the 14-line pre-Express server restored verbatim from its original commit in
this repository's history, against this implementation, each spawned as its own process and
driven with 200 sequential requests:

| Measurement | Baseline | After | Reading |
|---|---|---|---|
| Startup to the logged line | 63 ms | 178 ms | Inside the under-one-second budget, about 18% of it |
| Mean request latency | 13.149 ms | 14.054 ms | +0.905 ms, +6.9% |
| Working set, read from the process | 39.6 MB | 52.6 MB | +13.1 MB |

The absolute values differ from the planning figures above, and two of those differences are
worth naming rather than smoothing over. The latency numbers on this host sit *above* the 10 ms
budget on **both** sides of the comparison, the baseline included: they are measured end to end
from a client in another process on a slower virtualized host, so they carry client and loopback
cost that the planning measurement did not. What reproduces here is therefore the *delta* —
under a millisecond, single-digit percent — rather than the absolute budget, which only the
planning host's figures can speak to. And a Windows working set is not the same quantity as a
Unix resident set, so what reproduces on that line is the direction and the order of magnitude:
+13.1 MB here against the planning +17.6 MB. Startup stays comfortably inside its budget on both
hosts, and memory remains the one line that moves materially.

Safeguards applied:

- response literals are hoisted to module-scope constants, so no string is allocated per
  request;
- no body parser is mounted, so request bodies are never buffered or decoded;
- `etag` is disabled. This is a **fingerprint-parity and future-proofing** setting rather than a
  saving on the current code path: the framework computes an `ETag` inside its response
  helpers, and every response here is written with the raw `setHeader`/`end` pair instead, so no
  digest is being computed today. Disabling it guarantees the header cannot reappear if a helper
  is ever introduced;
- exactly two routes are registered, so the matcher compiles two static patterns once at
  startup;
- handlers perform constant-time synchronous writes with zero I/O and zero awaits.

Deliberately declined, each against the framework's own official guidance, and none of them
adopted:

- **payload compression** — for 13- and 14-byte bodies it would cost CPU and *add* bytes;
- **request logging middleware** — beyond the single preserved startup line;
- **the security-header bundle** — it targets an external-facing threat model this
  loopback-only fixture does not have, and loopback binding remains the primary control;
- **clustering**, **caching**, **load balancing**, **reverse proxying**, and **process
  managers** — each would add dependencies or infrastructure.

Declining all of them is what holds the direct dependency count at exactly one.

## Reproducibility and dependency integrity

- `express@5.2.1`, MIT licensed, declaring an engine floor of `node >= 18` and 28 direct
  dependencies of its own. That figure is the framework's own **compatibility** floor, and
  `package.json` propagates it verbatim under `engines`; it is not this project's support
  policy. See the runtime-support subsection below for the distinction, which matters because a
  clean package tree does nothing for an unpatched runtime.
- 67 installed packages in the resolved tree, pinned by a committed `package-lock.json` at
  `lockfileVersion 3`, whose `packages` object holds 68 entries — the repository root plus the
  67 installed packages.
- `npm ls --depth=0` reports `express@5.2.1` as the sole direct dependency.
- `npm audit --omit=dev` reports **0 vulnerabilities** on this exact tree.
- The installed tree is 595 files, excluded from version control by `.gitignore`. Its size
  depends on what is counted: 2.1 MB of file content measured here, 4.3 MB of disk usage
  measured during planning. The repository's own tracked source is about 101 KB across 16
  tracked files excluding the three binary assets — a third of it the committed lockfile, and
  well under 1 MB however it is counted.
- The test suite adds **zero** dependencies — there are no `devDependencies` at all.

### Runtime support policy

Two different numbers govern the runtime, and conflating them is the mistake this subsection
exists to prevent:

| | Value | What it means |
|---|---|---|
| **Compatibility floor** | `engines.node` = `>=18` in `package.json`, mirrored in the lockfile root | The oldest runtime the code *loads and runs* on. It is `express@5.2.1`'s own declared floor, propagated verbatim, and it is the exact value the project's plan of record fixes. |
| **Supported runtime** | **Node 22.12.0 or newer** — a currently supported LTS line | What the project is *supported on*, and what an operator should deploy. |

The gap between them is deliberate and it is not a documentation gap:

- **Node 18 and Node 20 are past end-of-life and receive no security patches.** A runtime or
  HTTP-parser defect on those lines is never fixed, so running there exposes the process to
  defects that no application-level control in this project can mitigate. Loopback-only binding
  narrows the reach of such a defect to local clients — including a browser on the same host —
  but it does not remove it. Nothing in this repository recommends those lines.
- **The packaged test suite needs the newer runner.** `npm test` is
  `node --test "tests/**/*.test.js"`, and the *runner* expands that glob — an ability it gained
  in Node 21. Measured on the four runtimes that matter here, with the command run exactly as
  npm runs it:

  ```text
  v22.23.2   8 suites, 31 tests, 31 pass, 0 fail            exit 0
  v21.7.3    8 suites, 31 tests, 31 pass, 0 fail            exit 0
  v20.20.2   Could not find '.../tests/**/*.test.js'        exit 1
  v18.20.8   Could not find '.../tests/**/*.test.js'        exit 1
  ```

  On Node 18 or 20 the pattern is taken literally and the run stops before a single test
  executes. That is a loud failure with a non-zero exit, not a green gate that verified
  nothing — but a quality gate that cannot run is still a quality gate you do not have, which is
  the second, independent reason the supported floor sits where it does. Note precisely what the
  two numbers each cover: the compatibility floor says the *server* loads on Node 18, and it
  does; it does not say the *test suite* runs there.
- **`engines` is left at the framework's `>=18` floor on purpose**, because that is the value
  the frozen plan of record specifies for this manifest field and it is factually correct as a
  compatibility statement. The support policy is expressed here and in the README rather than by
  narrowing that field, so the two facts stay distinguishable instead of one silently
  overwriting the other.

Verified on the host used for this work: Node **v22.23.2**, npm **10.9.8** — inside the
supported range, and comfortably above the compatibility floor.

### Prerequisites and commands

Node 22.12.0 or newer (see the support policy immediately above), and a free TCP port 3000 to
run the server (the test suite does not need it).

```bash
npm ci
npm start
npm test
```

The test command is a **quoted glob**, and each part of that matters. The runner expands the
pattern itself — a capability it gained in Node 21, which is why the supported runtime floor
above governs `npm test` as much as it governs security — so a suite added later under `tests/`
is discovered with no manifest edit; quoting keeps the shell out of the expansion, which matters
because `cmd.exe` does not expand globs at all; and a bare directory argument such as
`node --test tests` fails outright with a module-resolution error, measured at exit `1`, because
positional arguments are resolved as module paths. Both suites bind an **ephemeral** port by
passing `0` to `listen`, so `npm test` passes whether or not a server already holds port 3000.

One property of glob discovery is worth knowing in advance rather than discovering later: a
pattern that matches **nothing** is not an error, so the runner reports `# tests 0` and exits
`0`. The counts are therefore the thing to read, not the exit code alone. A healthy run on this
tree reports **8 suites and 31 tests, all passing** — 12 from `tests/endpoints.test.js` and 19
from `tests/regression.test.js`.

## Rules

Two user-specified rules apply to this project. Both are summarized below in the order they
appear in the rules document. These are **summaries of the obligations each rule imposes and
how this project discharges them, not transcriptions** — the authoritative full text of every
rule lives in the rules document itself, which is where a reader should go for the wording.

### Rule 1 — "QA-rules-02-june"

**Obligations: none.** The rule is present and counted among the two that apply, but its body
is empty: no directive, no constraint, no coding standard, no mandated artifact. Nothing in
this project traces to it, and nothing has been inferred or back-filled from its name. In the
absence of a directive the work is held to enterprise-standard practice instead, which for
this document means every stated number verified against live output, no aspirational claims,
and deltas disclosed rather than hidden.

### Rule 2 — "Ajit_New Product"

**Obligations: three.** That the product be created in Python; that each flow and feature be
clearly separated; and that the performance of the application not be impacted by the added
code. Each is dispositioned below. Nothing in this project prescribes, installs, or documents
any toolchain other than Node.js and npm, and the only prerequisites are the ones the README
lists.

**The language clause is set aside, explicitly rather than silently.** This project is
implemented in JavaScript on Node.js with `express@5.2.1`, on four independent grounds:

1. the request is the specific, current, in-band instruction, and it names both the framework
   and the existing artifact — *"this is a tutorial of node js server"*, while the rule is a
   generic standing rule;
2. the rule's own title scopes it to **new product** creation, whereas this is a feature
   addition to an existing, committed codebase;
3. literal compliance would require rewriting the server in another language, deleting the very
   endpoint the request asked to keep — *"add **another** endpoint"* — and a resolution that
   breaks the requirement it serves is not a resolution;
4. the repository contains no runtime, manifest or source for that language of any kind; the
   inventory is JavaScript, Java, JSON, Markdown and three binary assets.

**The separation clause is honored literally, and it is the strongest structural driver here.**
Seven modules exist *because of* it and would not otherwise have been created for a
two-endpoint server: configuration, the response emitter, one router per feature, the
route-miss flow, the error flow, and the composition root — with `server.js` reduced to the
bootstrap flow alone. Each has exactly one reason to change. The decomposition is idiomatic
rather than invented: the framework's own routing documentation presents its router class as
the mechanism for creating modular, mountable route handlers, each instance being a complete
middleware and routing system, and demonstrates defining a router in its own module file and
mounting it on the application. One router module per feature is therefore the idiomatic
expression of this rule in this stack. This document mirrors it in content: one document per
feature area, one row per endpoint.

**The performance clause is honored and measured** — see the section above, including the
disclosed memory increase.
