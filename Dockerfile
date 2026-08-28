# =============================================================================
# Stage 1: Build the frontend (React/Vite SPA)
# =============================================================================
FROM --platform=$BUILDPLATFORM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --prefer-offline --no-audit

COPY frontend/ ./
RUN npm run build && npm cache clean --force

# =============================================================================
# Stage 2: Build the backend (Rust) with LTO and Stripping
# =============================================================================
FROM rust:slim-bookworm AS backend-builder

RUN apt-get update && \
    apt-get install -y --no-install-recommends pkg-config libssl-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Cache dependencies
RUN cargo new backend
WORKDIR /app/backend
COPY backend/Cargo.toml backend/Cargo.lock ./
RUN cargo build --release && rm -rf src/*.rs target/release/deps/backend* target/release/backend*

# Build real application
COPY backend/src ./src
COPY backend/tests ./tests
RUN cargo build --release && strip target/release/backend

# =============================================================================
# Stage 3: Docker CLI & Compose plugin
# =============================================================================
FROM docker:27-cli AS docker-cli

# =============================================================================
# Stage 4: Minimal Runtime Image
# =============================================================================
FROM debian:bookworm-slim

# Install strictly necessary runtime dependencies without recommended packages (no X11/GUI bloat)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        libssl3 \
        sshpass \
        openssh-client \
        rclone \
        fuse3 \
        ffmpeg && \
    apt-get clean && \
    rm -rf \
        /var/lib/apt/lists/* \
        /tmp/* \
        /var/tmp/* \
        /usr/share/doc \
        /usr/share/man \
        /usr/share/locale

WORKDIR /app

# Copy compiled, stripped backend binary
COPY --from=backend-builder /app/backend/target/release/backend /usr/local/bin/orbit-backend

# Copy Docker CLI & Compose plugin
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/
COPY --from=docker-cli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/

# Copy built frontend assets
COPY --from=frontend-builder /app/frontend/dist ./public

# Prepare data volume directory
RUN mkdir -p /app/data

EXPOSE 5172

ENV RUST_LOG=info
ENV PORT=5172

CMD ["orbit-backend"]
