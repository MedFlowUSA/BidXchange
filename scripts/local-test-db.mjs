import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
export async function localTestDatabase({ includeCompanySeed = true } = {}) {
  const pg = new PGlite();
  await pg.exec(`create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,aud text,role text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,public to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  for (const name of [
    '20260919000100_tenant_foundation.sql',
    ...(includeCompanySeed ? ['20260919000200_ges_onboarding.sql'] : []),
    '20260919000300_admin_mutation_limit.sql',
    '20260919000400_organization_identity.sql',
  ])
    await pg.exec(readFileSync('supabase/migrations/' + name, 'utf8'));
  return {
    query: async (sql, args) => (args ? pg.query(sql, args) : (await pg.exec(sql)).at(-1)),
    end: () => pg.close(),
  };
}
