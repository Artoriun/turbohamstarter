import path from 'node:path';
import dotenv from 'dotenv';

// Loads packages/api/.env relative to this file rather than the working directory.
// `dotenv/config` reads from cwd, so starting the built entry the way Render does —
// `node packages/api/dist/index.js` from the repo root — found no .env and the process
// died on missing Firebase credentials. Both src/ and dist/ sit one level under
// packages/api, so '../.env' is correct whether running from source or compiled.
//
// This lives in its own module because it has to run before anything that reads
// process.env at import time (firebaseAdmin does). Imports are evaluated before
// statements, so calling dotenv.config() inside index.ts would run too late.
//
// A missing file is not an error: on Render the values come from the environment.
dotenv.config({ path: path.resolve(__dirname, '../.env') });
