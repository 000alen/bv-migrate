/**
 * Integration test configuration.
 * Reads required env vars and throws a clear error if any are missing.
 * Set these before running: CIRCLE_TOKEN, ANTHROPIC_KEY, SPACE_GROUP_ID
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Integration tests require the ${name} environment variable to be set.\n` +
        `Example: ${name}=your_value pnpm test:integration`
    );
  }
  return value;
}

export const CIRCLE_TOKEN: string = requireEnv("CIRCLE_TOKEN");
export const ANTHROPIC_KEY: string = requireEnv("ANTHROPIC_KEY");
export const SPACE_GROUP_ID: number = (() => {
  const raw = requireEnv("SPACE_GROUP_ID");
  const n = parseInt(raw, 10);
  if (isNaN(n) || n <= 0) {
    throw new Error(`SPACE_GROUP_ID must be a positive integer, got: ${raw}`);
  }
  return n;
})();

/**
 * All test resources are prefixed with this string so they can be identified
 * and swept even after an interrupted test run.
 */
export const TEST_PREFIX = "__test_bv_migrate_";
