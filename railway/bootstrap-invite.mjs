// First-admin invite helper for Paperclip on Railway.
//
// In authenticated + public mode Paperclip deliberately disables browser-based
// instance claiming; the operator must mint a one-time "bootstrap_ceo" invite
// from the host (upstream: `paperclipai auth bootstrap-ceo`). Railway has no
// host shell by default, so this helper does the same thing automatically:
// once the server is healthy and still reports bootstrapStatus=bootstrap_pending,
// it revokes any older pending bootstrap invites, creates a fresh one exactly
// like the upstream CLI (sha256 token hash, human-only, 72h expiry) and prints
// the invite URL to the deploy logs. Once an admin exists it does nothing.
import { createHash, randomBytes } from "node:crypto";
import { createRequire } from "node:module";

const log = (msg) => console.log(`[railway-bootstrap] ${msg}`);
const port = process.env.PORT || "3100";
const healthUrl = `http://127.0.0.1:${port}/api/health`;
const publicUrl = (process.env.PAPERCLIP_PUBLIC_URL || `http://localhost:${port}`).replace(/\/+$/, "");
const dbUrl = process.env.DATABASE_URL;
const expiresHours = Math.max(1, Math.min(720, Number(process.env.PAPERCLIP_BOOTSTRAP_INVITE_HOURS) || 72));

async function waitForHealth(timeoutMs = 15 * 60 * 1000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const body = await res.json();
        if (body && body.status === "ok" && body.bootstrapStatus) return body;
      }
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null;
}

async function main() {
  if (!dbUrl) {
    log("DATABASE_URL is not set; skipping first-admin invite (run `paperclipai auth bootstrap-ceo` manually).");
    return;
  }
  const health = await waitForHealth();
  if (!health) {
    log("server did not become healthy in time; skipping first-admin invite.");
    return;
  }
  if (health.deploymentMode !== "authenticated" || health.bootstrapStatus !== "bootstrap_pending") {
    return; // admin already exists (or local_trusted mode): nothing to do
  }

  const require = createRequire("/app/packages/db/package.json");
  const postgres = require("postgres");
  const sql = postgres(dbUrl, { max: 1, onnotice: () => {} });
  try {
    const [{ count }] = await sql`SELECT count(*)::int AS count FROM instance_user_roles WHERE role = 'instance_admin'`;
    if (count > 0) return;

    const now = new Date();
    await sql`
      UPDATE invites SET revoked_at = ${now}, updated_at = ${now}
      WHERE invite_type = 'bootstrap_ceo' AND revoked_at IS NULL AND accepted_at IS NULL AND expires_at > ${now}`;

    const token = `pcp_bootstrap_${randomBytes(24).toString("hex")}`;
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + expiresHours * 3600 * 1000);
    await sql`
      INSERT INTO invites (invite_type, token_hash, allowed_join_types, expires_at, invited_by_user_id)
      VALUES ('bootstrap_ceo', ${tokenHash}, 'human', ${expiresAt}, 'system')`;

    log("==================================================================");
    log("No Paperclip admin yet. Open this one-time first-admin invite URL:");
    log(`  ${publicUrl}/invite/${token}`);
    log(`Expires: ${expiresAt.toISOString()} (a fresh link is printed on every restart until claimed)`);
    log("==================================================================");
  } finally {
    await sql.end({ timeout: 5 }).catch(() => {});
  }
}

main().catch((err) => {
  log(`could not create first-admin invite: ${err && err.message ? err.message : String(err)}`);
});
