# hao-backprop-test
test project for backprop integration. Do not touch!

## Getting started

Requires Node.js 18.8 or higher, mirrored by `engines.node` in `package.json`. Express 5's own floor is 18; `npm test` raises it to 18.8, the release where Node's built-in test runner began exporting the `before`/`after` hooks the smoke suite uses.

```bash
npm install   # install dependencies (Express)
npm start     # serve on http://127.0.0.1:3000
npm test      # run the endpoint smoke tests (node --test)
```

## Endpoints

Base URL: `http://127.0.0.1:3000`

| Method | Path | Response |
|--------|------|----------|
| `GET` | `/` | `Hello, World!` |
| `GET` | `/good-evening` | `Good evening` |

Responses are `text/plain; charset=utf-8` and end with a trailing newline, so `/` returns 14 bytes and `/good-evening` returns 13. Only `GET` is served, plus `HEAD`, which Express answers from the same two routes; any unmatched path or method returns `404` with the plain-text body `Not Found`.
