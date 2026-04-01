/**
 * Integration test configuration.
 * Does not throw on import — use `has*` helpers with `describe.skipIf` so
 * `pnpm test:integration` passes when credentials are absent (e.g. CI).
 *
 * With credentials:
 *   CIRCLE_TOKEN=... ANTHROPIC_KEY=... SPACE_GROUP_ID=... pnpm test:integration
 */

export const TEST_PREFIX = "__test_bv_migrate_";

export function hasCircleIntegrationEnv(): boolean {
  const token = process.env.CIRCLE_TOKEN?.trim();
  const raw = process.env.SPACE_GROUP_ID?.trim();
  if (!token || !raw) return false;
  const n = parseInt(raw, 10);
  return !isNaN(n) && n > 0;
}

export function getCircleIntegrationEnv(): {
  CIRCLE_TOKEN: string;
  SPACE_GROUP_ID: number;
} {
  const CIRCLE_TOKEN = process.env.CIRCLE_TOKEN?.trim();
  const raw = process.env.SPACE_GROUP_ID?.trim();
  if (!CIRCLE_TOKEN || !raw) {
    throw new Error(
      "Missing CIRCLE_TOKEN or SPACE_GROUP_ID (should only call when hasCircleIntegrationEnv() is true)"
    );
  }
  const n = parseInt(raw, 10);
  if (isNaN(n) || n <= 0) {
    throw new Error(`SPACE_GROUP_ID must be a positive integer, got: ${raw}`);
  }
  return { CIRCLE_TOKEN, SPACE_GROUP_ID: n };
}

export function hasAnthropicExtractEnv(): boolean {
  return Boolean(process.env.ANTHROPIC_KEY?.trim());
}

export function getAnthropicExtractKey(): string {
  const key = process.env.ANTHROPIC_KEY?.trim();
  if (!key) {
    throw new Error(
      "Missing ANTHROPIC_KEY (should only call when hasAnthropicExtractEnv() is true)"
    );
  }
  return key;
}
