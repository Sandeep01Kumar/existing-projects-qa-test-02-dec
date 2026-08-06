const express = require('express');

const app = express();
const hostname = '127.0.0.1';
const port = 3000;

// Free hardening: do not advertise the framework in every response.
app.disable('x-powered-by');

// Keep this 14-byte body unchanged, including punctuation and the trailing newline.
app.get('/', (req, res) => {
  res.status(200).type('text/plain').send('Hello, World!\n');
});

app.get('/good-evening', (req, res) => {
  res.status(200).type('text/plain').send('Good evening\n');
});

// Terminal handler, registered last so it never shadows the routes above. Pathless
// by design: Express 5 rejects a bare '*' path, and this keeps 404s in plain text.
app.use((req, res) => {
  res.status(404).type('text/plain').send('Not Found\n');
});

// Bind only when run directly, so the app can be imported without opening a port.
if (require.main === module) {
  app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
  });
}

module.exports = app;
