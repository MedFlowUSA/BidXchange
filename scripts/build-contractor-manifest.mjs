import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const path = 'scripts/staging/migrations.json';
const manifest = JSON.parse(readFileSync(path, 'utf8'));
const old = new Map(manifest.migrations.map((m) => [m.file, m]));
manifest.migrations = readdirSync('supabase/migrations')
  .sort()
  .map((file) => {
    const sha256 = createHash('sha256')
      .update(readFileSync('supabase/migrations/' + file, 'utf8').replace(/\r\n/g, '\n'))
      .digest('hex');
    if (old.has(file) && file < '20260921002000' && old.get(file).sha256 !== sha256)
      throw new Error('Historical migration changed: ' + file);
    return {
      file,
      sha256,
      action: file === '20260919000200_ges_onboarding.sql' ? 'exclude-data-seed' : 'include-schema',
    };
  });
manifest.packageRevision = 14;
writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
