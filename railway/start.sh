#!/bin/sh
# Railway start wrapper for the official Paperclip image.
# Runs as `node` (the upstream docker-entrypoint.sh has already fixed /paperclip
# ownership and dropped privileges). It only:
#   1. derives PAPERCLIP_PUBLIC_URL / PAPERCLIP_API_URL from RAILWAY_PUBLIC_DOMAIN
#      when they are not set explicitly, and
#   2. starts a one-shot helper that prints a first-admin invite URL to the
#      deploy logs while the instance has no admin yet,
# then execs the exact upstream server command.
set -e

if [ -z "${PAPERCLIP_PUBLIC_URL:-}" ] && [ -n "${RAILWAY_PUBLIC_DOMAIN:-}" ]; then
  export PAPERCLIP_PUBLIC_URL="https://${RAILWAY_PUBLIC_DOMAIN}"
fi
if [ -z "${PAPERCLIP_API_URL:-}" ] && [ -n "${PAPERCLIP_PUBLIC_URL:-}" ]; then
  export PAPERCLIP_API_URL="${PAPERCLIP_PUBLIC_URL}"
fi

if [ "${PAPERCLIP_RAILWAY_BOOTSTRAP_INVITE:-true}" = "true" ]; then
  # Double fork so the helper is re-parented to tini (PID 1) and reaped there.
  ( node /railway/bootstrap-invite.mjs & )
fi

exec node --import ./server/node_modules/tsx/dist/loader.mjs server/dist/index.js
