# =============================================================
# DataRegimen — Dockerfile
# Base: nginxinc/nginx-unprivileged (runs as UID 101, non-root)
# Cloud Run requires the container to listen on $PORT (default 8080)
# =============================================================

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# Switch to root only for setup, then drop back to nginx user
USER root

# Strip default config, replace with our own
RUN rm -rf /etc/nginx/conf.d/* /etc/nginx/nginx.conf \
 && mkdir -p /tmp/client_temp /tmp/proxy_temp_path /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp \
 && chown -R nginx:nginx /tmp /var/cache/nginx

# Copy nginx config
COPY nginx.conf /etc/nginx/nginx.conf
COPY default.conf.template /etc/nginx/templates/default.conf.template

# Copy static site
COPY --chown=nginx:nginx site/ /usr/share/nginx/html/

# Make sure nginx user can read everything
RUN chmod -R a+rX /usr/share/nginx/html \
 && chown -R nginx:nginx /usr/share/nginx/html

# Cloud Run sends SIGTERM. PORT is injected at runtime.
ENV PORT=8080
EXPOSE 8080

USER nginx

# nginx-unprivileged's entrypoint already runs envsubst on
# /etc/nginx/templates/*.template -> /etc/nginx/conf.d/*.conf
# using $PORT before launching nginx.
CMD ["nginx", "-g", "daemon off;"]
