# Paperclip 2026.1012.0 (paperclipai/paperclip) for Railway — official GHCR image, pinned by digest
# (multi-arch index; same digest as :latest on 2026-10-15, upstream commit bba6a45f0).
FROM ghcr.io/paperclipai/paperclip:2026.1012.0@sha256:1661b3dd3fdf7a9b59542d1ced464c3faf9dc8309798b4d15a9923ed32795307

# Production defaults for a public Railway deployment. Everything can be overridden in Railway Variables.
ENV HOST=0.0.0.0 \
    PAPERCLIP_BIND=lan \
    PORT=3100 \
    SERVE_UI=true \
    PAPERCLIP_HOME=/paperclip \
    PAPERCLIP_DEPLOYMENT_MODE=authenticated \
    PAPERCLIP_DEPLOYMENT_EXPOSURE=public

# Tiny Railway wrapper: derive the public URL from RAILWAY_PUBLIC_DOMAIN and print a
# one-time first-admin invite URL to the deploy logs (public mode has no browser claim).
COPY --chmod=0755 railway/ /railway/

EXPOSE 3100

# Upstream ENTRYPOINT is kept (tini -> docker-entrypoint.sh: chowns the root-owned Railway
# volume at /paperclip, then drops to `node`). start.sh then execs the upstream server CMD.
CMD ["/railway/start.sh"]
