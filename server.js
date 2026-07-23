const express = require('express');

const hostname = '127.0.0.1';
const port = 3000;

const app = express();

app.get('/', (req, res) => {
  res.status(200).type('text/plain').send('Hello, World!\n');
});

app.get('/good-evening', (req, res) => {
  res.status(200).type('text/plain').send('Good evening');
});

app.listen(port, hostname, (error) => {
  // Express 5 invokes this listen callback for both the 'listening' event and a
  // server 'error' (e.g. EADDRINUSE). Fail loudly on error rather than logging a
  // false "success" line and exiting 0, which would hide a startup failure.
  if (error) {
    throw error;
  }
  console.log(`Server running at http://${hostname}:${port}/`);
});
