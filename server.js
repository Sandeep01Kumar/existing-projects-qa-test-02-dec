const express = require('express');                                                             // Import the Express web framework (declared as a dependency in package.json)
const hostname = '127.0.0.1';                                                                   // Loopback host to bind on — preserved unchanged from the original server
const port = 3000;                                                                              // TCP port to listen on — preserved unchanged from the original server
const app = express();                                                                          // Create the Express application instance (replaces http.createServer)
app.get('/', (req, res) => res.type('text/plain').send('Hello, World!\n'));                     // GET / : preserved original endpoint — text/plain, exact body incl. trailing newline
app.get('/good-evening', (req, res) => res.type('text/plain').send('Good evening\n'));          // GET /good-evening : NEW endpoint — text/plain "Good evening" response with trailing newline
app.listen(port, hostname, () => console.log(`Server running at http://${hostname}:${port}/`)); // Start listening on the configured host/port and log the startup message (preserved verbatim)
