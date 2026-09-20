import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const manifest = JSON.parse(
  readFileSync(new URL('./migrations.json', import.meta.url), 'utf8'),
);
export function validateMigrations(directory, expected = manifest) {
  assert.equal(expected.version, 1);
  assert.equal(expected.hashFormat, 'sha256-utf8-lf');
  const actual = readdirSync(directory).sort();
  assert.deepEqual(
    actual,
    expected.migrations.map((m) => m.file).sort(),
    'Unreviewed migration inventory',
  );
  assert.equal(expected.migrations.filter((m) => m.action === 'exclude-data-seed').length, 1);
  const included = [];
  for (const entry of expected.migrations) {
    assert(/^[0-9]{14}_[a-z_]+\.sql$/.test(entry.file));
    assert(['include-schema', 'exclude-data-seed'].includes(entry.action));
    assert(
      !lstatSync(path.join(directory, entry.file)).isSymbolicLink(),
      'Migration symlinks refused',
    );
    const sql = readFileSync(path.join(directory, entry.file), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(
      createHash('sha256').update(sql).digest('hex'),
      entry.sha256,
      'Migration checksum changed: ' + entry.file,
    );
    if (entry.action === 'exclude-data-seed') {
      assert.equal(entry.file, '20260919000200_ges_onboarding.sql');
    } else included.push({ file: entry.file, sql });
  }
  return included;
}

export function preparePackage(root = repository) {
  const files = validateMigrations(path.join(root, 'supabase/migrations'));
  assert(Number.isSafeInteger(manifest.packageRevision) && manifest.packageRevision >= 1);
  const destination = path.join(
    root,
    `.tmp/bidxchange-staging-package-r${manifest.packageRevision}`,
  );
  const packageFiles = new Map([
    ['manifest.json', JSON.stringify(manifest, null, 2) + '\n'],
    [
      'README.txt',
      'OFFLINE PACKAGE ONLY. No project is linked. Resource/link/deployment approval is required.\nMigration 002 is deliberately excluded; never mark it applied. No company seed or credentials are included.\nUse only this reviewed migration subset for staging; never run root migration push against staging.\n',
    ],
    ...files.map((f) => ['migrations/' + f.file, f.sql]),
  ]);
  // Reject linked workdirs, extra files, tampering and path redirection before writing anything.
  for (const dir of [root, path.join(root, '.tmp'), destination]) {
    if (existsSync(dir)) assert(!lstatSync(dir).isSymbolicLink(), 'Output symlinks refused');
  }
  if (existsSync(destination)) {
    const inspect = (dir, prefix = '') => {
      for (const name of readdirSync(dir)) {
        const target = path.join(dir, name),
          relative = prefix + name;
        const stat = lstatSync(target);
        assert(!stat.isSymbolicLink(), 'Output symlinks refused');
        if (stat.isDirectory()) {
          assert.equal(relative, 'migrations', 'Unexpected directory or project linkage');
          inspect(target, relative + '/');
        } else {
          assert(packageFiles.has(relative), 'Unexpected package file or project linkage');
          assert.equal(
            readFileSync(target, 'utf8'),
            packageFiles.get(relative),
            'Existing package changed',
          );
        }
      }
    };
    inspect(destination);
  }
  mkdirSync(path.join(destination, 'migrations'), { recursive: true });
  for (const [name, content] of packageFiles) {
    const target = path.join(destination, name);
    if (!existsSync(target)) writeFileSync(target, content, { flag: 'wx' });
  }
  return {
    destination,
    included: files.map((f) => f.file),
    excluded: manifest.migrations
      .filter((m) => m.action === 'exclude-data-seed')
      .map((m) => m.file),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(
    process.argv.length,
    2,
    'This offline command accepts no target or credential arguments',
  );
  console.log(JSON.stringify(preparePackage(), null, 2));
}
