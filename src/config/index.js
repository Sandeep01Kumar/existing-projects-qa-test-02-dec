/*
 * Configuration flow - the single source of truth for every literal this
 * application needs, at startup and on the response path.
 *
 * The values are lifted verbatim from the original core-http server
 * (server.js lines 3, 4 and 8), which is what makes the observable contract
 * survive the move to Express. ADR-004 is deliberately retained: they stay
 * literal in source. Consolidating them here removes the
 * same-constant-in-several-places hazard without externalising anything -
 * this project reads no environment, no config file and no command line.
 *
 * This module imports nothing at all. It is required by path - './src/config'
 * from the root bootstrap, '../config' from src/lib/textResponse.js - and both
 * rely on Node directory-index resolution landing on this index.js, so the
 * filename is itself part of the contract.
 */

// Loopback-only bind address (ADR-002, the system's primary security
// control). The bootstrap must pass it to listen alongside PORT: omitting it
// binds every interface. The exact literal also keeps the startup log
// byte-identical to the baseline server's.
const HOSTNAME = '127.0.0.1';

// Numeric on purpose - a quoted value would still bind, but it would not be a
// verbatim lift and it breaks the type checks that lock this contract down.
const PORT = 3000;

// Written straight into the Content-Type header by the shared response
// emitter, so it stays the bare media type with no parameters appended;
// Express's own response helpers would append an encoding parameter.
const MEDIA_TYPE = 'text/plain';

module.exports = { HOSTNAME, PORT, MEDIA_TYPE };
