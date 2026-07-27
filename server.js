const express = require('express');
const app = express();

const hostname = '127.0.0.1';
const port = 3000;

app.get('/', (req, res) => {
  res.type('text/plain').send('Hello, World!\n');
});

app.get('/good-evening', (req, res) => {
  res.type('text/plain').send('Good evening\n');
});

app.listen(port, hostname, (err) => {
  // Express's app.listen registers this callback as the server's 'error' handler in
  // addition to the 'listening' callback, so a failed bind (e.g. EADDRINUSE when the
  // port is already in use) invokes it with an error argument. Surface that error on
  // stderr and exit with a non-zero code instead of falsely logging a successful
  // startup and exiting 0.
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server running at http://${hostname}:${port}/`);
});
