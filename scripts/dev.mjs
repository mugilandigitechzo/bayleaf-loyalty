// Development: rebuild the web app on change and restart the API on change.
import { spawn } from 'node:child_process';

const run = (cmd, args, env = {}) => spawn(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } });
run('node', ['scripts/build-web.mjs', '--watch'], { NODE_ENV: 'development' });
run('node', ['--import', 'tsx', '--watch-path=server', '--watch-path=shared', 'server/index.ts'], { NODE_ENV: 'development' });
