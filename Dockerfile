# ============================================================
# Production Dockerfile
# Ultra-lightweight, high-performance Alpine NGINX web server
# Compatible with Google Cloud Run, AWS ECS, Railway, Render, K8s
# ============================================================

FROM nginx:1.27-alpine-slim

# Copy custom NGINX configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static web application assets
COPY index.html styles.css app.js config.js sw.js manifest.webmanifest healthz.json /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/

# Set proper ownership and permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Expose standard unprivileged container port (Cloud Run default)
EXPOSE 8080

# Health check probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/healthz || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
