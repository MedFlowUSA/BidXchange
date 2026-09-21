// Explicit operator-only job. No linked-project fallback, browser route, or installed cron.
import pg from 'pg';
import { samConfig, samConnector } from '../../apps/web/lib/sources/sam';
import { synchronize } from './sync';
async function main() {
  const config = samConfig(process.env);
  if (!config.key || !config.enabled) {
    console.log('SAM.gov connection not configured or synchronization disabled. No request sent.');
    process.exit(0);
  }
  if (!process.argv.includes('--approved-sync') || !process.env.BIDXCHANGE_SOURCE_DATABASE_URL) {
    console.log('Explicit --approved-sync and private BIDXCHANGE_SOURCE_DATABASE_URL required.');
    process.exit(1);
  }
  const db = new pg.Client({
    connectionString: process.env.BIDXCHANGE_SOURCE_DATABASE_URL,
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000,
  });
  const controller = new AbortController();
  process.once('SIGTERM', () => controller.abort());
  process.once('SIGINT', () => controller.abort());
  try {
    const to = new Date(
      process.env.BIDXCHANGE_SAM_SYNC_TO ?? new Date().toISOString().slice(0, 10),
    );
    const from = new Date(
      process.env.BIDXCHANGE_SAM_SYNC_FROM ??
        new Date(to.getTime() - (config.days - 1) * 86400000).toISOString(),
    );
    const connector = samConnector(config, from, to);
    await db.connect();
    const result = await synchronize(db, connector, {
      from,
      to,
      pages: config.pages,
      limit: config.limit,
      secret: config.key,
      signal: controller.signal,
    });
    console.log(JSON.stringify(result));
    if (result.errorCode || result.failed) process.exitCode = 1;
  } catch {
    console.error('Source job failed. Check private configuration and sanitized run history.');
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
main().catch(() => {
  console.error('Source job configuration failed.');
  process.exitCode = 1;
});
