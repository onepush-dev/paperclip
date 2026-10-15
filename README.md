# Paperclip — open-source AI agent orchestration (official image + Postgres). Deploy on Railway with one click.

<!-- Deploy button: replace DEPLOY_CODE once the Railway template is generated -->
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/DEPLOY_CODE)

[Paperclip](https://paperclip.ing) runs a company of AI agents: an org chart, goals, issues, budgets and heartbeats, with built-in adapters for Claude Code, Codex, OpenCode and Gemini CLI. This template ships the **official** `ghcr.io/paperclipai/paperclip` image, digest-pinned, on **Railway Postgres** with a persistent volume, in **authenticated + public** mode, and needs **no deploy-time input**.

## Why this template
- **Official image, digest-pinned:** `ghcr.io/paperclipai/paperclip:2026.1012.0@sha256:1661b3dd3fdf7a9b59542d1ced464c3faf9dc8309798b4d15a9923ed32795307` (same as `latest` on 2026-10-15, upstream commit `bba6a45f0`). Upstream ENTRYPOINT and server command are unchanged.
- **Production architecture from the upstream docs:** hosted Postgres (Railway) via `DATABASE_URL`, not the embedded database (upstream: "Embedded Postgres is for local only"). Migrations run automatically on boot.
- **Correct persistence:** Railway volume at `/paperclip` (`PAPERCLIP_HOME`): uploads, instance config, agent workspaces, the local secrets key.
- **Internet-safe by default:** `PAPERCLIP_DEPLOYMENT_MODE=authenticated` + `PAPERCLIP_DEPLOYMENT_EXPOSURE=public`, with the public URL taken from the Railway domain automatically.
- **Zero deploy-time config:** `BETTER_AUTH_SECRET`, `PAPERCLIP_AGENT_JWT_SECRET` and `PAPERCLIP_SECRETS_MASTER_KEY` are generated per deploy. LLM keys are optional and added afterwards.
- **First admin without a shell:** public mode intentionally disables browser claiming. The template prints a one-time first-admin invite URL in the deploy logs, which is the same invite `paperclipai auth bootstrap-ceo` creates.

## Services
| Service | Source | Notes |
|---|---|---|
| paperclip | image `ghcr.io/paperclipai/paperclip:2026.1012.0@sha256:1661b3dd3fdf7a9b59542d1ced464c3faf9dc8309798b4d15a9923ed32795307` | port `3100`, public domain, volume `/paperclip`, health `/api/health`, custom start command below |
| Postgres | Railway Postgres (`postgres-ssl:18`) | `DATABASE_URL` referenced by paperclip |

**Start command.** The template deploys the official image directly, with no build step. Railway replaces the image ENTRYPOINT when a start command is set, so the command runs the upstream `tini` + `docker-entrypoint.sh` itself. The entrypoint chowns the root-owned volume and drops to `node`. The command then starts the first-admin invite helper (from `PAPERCLIP_RAILWAY_BOOTSTRAP_JS`) and `exec`s the upstream server command unchanged:
```
/bin/sh -c "printenv PAPERCLIP_RAILWAY_BOOTSTRAP_JS > /tmp/railway-bootstrap.mjs || true; chmod 644 /tmp/railway-bootstrap.mjs; exec /usr/bin/tini -s -- docker-entrypoint.sh /bin/sh -c 'cd /app; if [ -s /tmp/railway-bootstrap.mjs ] && [ ${PAPERCLIP_RAILWAY_BOOTSTRAP_INVITE:-true} = true ]; then (node /tmp/railway-bootstrap.mjs &); fi; exec node --import ./server/node_modules/tsx/dist/loader.mjs server/dist/index.js'"
```
(Also in `start-command.txt`.) The repo `Dockerfile` + `railway/` is an equivalent build-from-repo option: it bakes the same helper into `/railway/` with `CMD ["/railway/start.sh"]`, so it needs no start command and no `PAPERCLIP_RAILWAY_BOOTSTRAP_JS`.

## Variables (paperclip service)
| Variable | Template value | Secret |
|---|---|---|
| HOST | `0.0.0.0` | |
| PAPERCLIP_BIND | `lan` | |
| PORT | `3100` | |
| SERVE_UI | `true` | |
| PAPERCLIP_HOME | `/paperclip` | |
| PAPERCLIP_DEPLOYMENT_MODE | `authenticated` | |
| PAPERCLIP_DEPLOYMENT_EXPOSURE | `public` | |
| PAPERCLIP_PUBLIC_URL | `https://${{RAILWAY_PUBLIC_DOMAIN}}` | |
| PAPERCLIP_API_URL | `https://${{RAILWAY_PUBLIC_DOMAIN}}` | |
| DATABASE_URL | `${{Postgres.DATABASE_URL}}` | yes (reference) |
| BETTER_AUTH_SECRET | `${{secret(64, "abcdef0123456789")}}` | yes |
| PAPERCLIP_AGENT_JWT_SECRET | `${{secret(64, "abcdef0123456789")}}` | yes |
| PAPERCLIP_SECRETS_MASTER_KEY | `${{secret(64, "abcdef0123456789")}}`. Encrypts company secrets stored in Postgres. Keep it; changing it makes existing secrets unreadable. | yes |
| OPENAI_API_KEY | empty, set after deploy | |
| ANTHROPIC_API_KEY | empty, set after deploy | |
| GEMINI_API_KEY | empty, set after deploy | |
| PAPERCLIP_RAILWAY_BOOTSTRAP_INVITE | `true`. Set to `false` to stop printing the first-admin invite. | |
| PAPERCLIP_RAILWAY_BOOTSTRAP_JS | contents of `railway/bootstrap-invite.min.mjs` (one line). This is the invite helper the start command runs. | |

## After deploy
1. Open the paperclip service → **Deployments → View logs** and find the `[railway-bootstrap]` block:
   ```
   [railway-bootstrap] No Paperclip admin yet. Open this one-time first-admin invite URL:
   [railway-bootstrap]   https://<your-domain>/invite/pcp_bootstrap_…
   ```
2. Open `https://<your-domain>`, create your account, then open the invite URL in the same browser. You become the instance admin and go straight to onboarding. The link lasts 72h, and a fresh one is printed on every restart until someone claims it.
3. (Recommended) Once you are admin, set `PAPERCLIP_AUTH_DISABLE_SIGN_UP=true` and redeploy. Add teammates with invites.
4. Add an LLM key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `GEMINI_API_KEY`) so the bundled Claude Code / Codex / Gemini adapters can run agents.

Health (no auth): `GET https://<your-domain>/api/health` returns `200` `{"status":"ok",…}`.

## Notes
- Run **one replica**: agent workspaces and the secrets key live on the `/paperclip` volume.
- The invite helper (`railway/bootstrap-invite.mjs`, minified in `bootstrap-invite.min.mjs`) waits for `/api/health`. If the instance still reports `bootstrap_pending`, it revokes older pending bootstrap invites and inserts a new `bootstrap_ceo` invite, the same way upstream `paperclipai auth bootstrap-ceo` does (sha256 token hash, human-only, 72h). Once an admin exists it only logs `instance already has an admin`. If an invite expires before anyone claims it, restart the service to get a new one.
- Back up Postgres from Railway. Company exports are documented upstream.
- Upstream: https://github.com/paperclipai/paperclip · Docs: https://docs.paperclip.ing/reference/deploy/docker/ · https://docs.paperclip.ing/how-to/deploy-to-vps-or-fly/
