import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);
const patterns = [
  /sb_secret_[A-Za-z0-9_-]{15,}/,
  /sbp_[a-f0-9]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{15,}/,
  /(?:password|service_role_key)\s*[:=]\s*["'][^"'\s]{8,}["']/i,
];
const failures = [];
for (const file of new Set(files)) {
  if (
    /\.(png|jpg|ico|woff2?|pdf)$/.test(file) ||
    file === 'scripts/scan-secrets.mjs' ||
    file === 'package-lock.json'
  )
    continue;
  const text = readFileSync(file, 'utf8');
  if (patterns.some((p) => p.test(text))) failures.push(file);
  if (/(^|\/)\.env(\.local)?$/.test(file)) failures.push(file);
}
if (failures.length) {
  console.error('Potential secrets in files (values withheld):', failures.join(', '));
  process.exitCode = 1;
} else
  console.log(
    `Secret scan passed across ${new Set(files).size} tracked and unignored source files.`,
  );
