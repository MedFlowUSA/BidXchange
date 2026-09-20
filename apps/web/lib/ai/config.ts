import 'server-only';
import { stagingConfig } from './staging-provider';
// STAGING BRANCH ONLY: paid AI cannot be configured in this build.
export function aiConfig() {
  return stagingConfig(process.env);
}
