# =================================================================
# OpsMind React Frontend — Production Multi-Stage Dockerfile
# =================================================================
# Stage 1: Build the Vite bundle
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

# Build Vite SPA
ARG VITE_API_BASE_URL=/api
ARG VITE_ML_SERVICE_URL=/api/ml
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_ML_SERVICE_URL=$VITE_ML_SERVICE_URL

RUN npm run build

# Stage 2: Serve with Nginx Alpine
FROM nginx:alpine

# Remove default static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy build artifacts and custom nginx configuration
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
