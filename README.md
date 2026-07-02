# hao-backprop-test

A minimal Node.js tutorial HTTP server, now built on the [Express.js](https://expressjs.com/)
web framework. It exposes two plain-text endpoints and listens on `http://127.0.0.1:3000/`.
This remains a small test/integration fixture for backprop integration.

## Endpoints

| Method | Path            | Response        | Content-Type | Status |
| ------ | --------------- | --------------- | ------------ | ------ |
| GET    | `/`             | `Hello, World!` | text/plain   | 200    |
| GET    | `/good-evening` | `Good evening`  | text/plain   | 200    |

- `GET /` is the preserved original behavior.
- `GET /good-evening` is the new endpoint.

The server binds to `http://127.0.0.1:3000/`.

## Requirements

- [Node.js](https://nodejs.org/) `>= 18` (required by Express 5).

## Dependencies

- [`express`](https://www.npmjs.com/package/express) `^5.2.1` (MIT licensed) — web
  framework providing routing for the two HTTP endpoints.

## Getting Started

Install dependencies:

```bash
npm install
```

Start the server:

```bash
node server.js
```

On startup the server logs:

```text
Server running at http://127.0.0.1:3000/
```

## Usage

With the server running, call the endpoints:

```bash
curl http://127.0.0.1:3000/
# -> Hello, World!

curl http://127.0.0.1:3000/good-evening
# -> Good evening
```
