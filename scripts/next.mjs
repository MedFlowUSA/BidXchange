import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const command = process.argv[2] ?? 'dev';
const child = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    command,
    'apps/web',
    '--hostname',
    '127.0.0.1',
    ...process.argv.slice(3),
  ],
  { stdio: 'inherit', env: process.env },
);
child.on('exit', (code) => process.exit(code ?? 1));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
