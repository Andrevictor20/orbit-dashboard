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
# Stage 2: Build the backend (Rust) with Native Cross-Compilation (No QEMU lag!)
# =============================================================================
FROM --platform=$BUILDPLATFORM rust:slim-bookworm AS backend-builder
ARG TARGETARCH

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        pkg-config \
        libssl-dev \
        gcc-aarch64-linux-gnu \
        libc6-dev-arm64-cross && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# Setup cross-compilation target
RUN if [ "$TARGETARCH" = "arm64" ]; then \
        rustup target add aarch64-unknown-linux-gnu; \
    fi

COPY backend/Cargo.toml backend/Cargo.lock ./

# Cache dependencies
RUN mkdir -p src && echo "fn main() {}" > src/main.rs && echo "pub fn lib() {}" > src/lib.rs && \
    if [ "$TARGETARCH" = "arm64" ]; then \
        export CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc; \
        export CC_aarch64_unknown_linux_gnu=aarch64-linux-gnu-gcc; \
        cargo build --release --target aarch64-unknown-linux-gnu; \
    else \
        cargo build --release; \
    fi && \
    rm -rf src

# Cache bust: APP_VERSION changes per commit, invalidating backend source cache
ARG APP_VERSION=dev
COPY backend/src ./src
COPY backend/tests ./tests

RUN touch src/*.rs && \
    if [ "$TARGETARCH" = "arm64" ]; then \
        export CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc; \
        export CC_aarch64_unknown_linux_gnu=aarch64-linux-gnu-gcc; \
        cargo build --release --target aarch64-unknown-linux-gnu && \
        aarch64-linux-gnu-strip target/aarch64-unknown-linux-gnu/release/backend && \
        cp target/aarch64-unknown-linux-gnu/release/backend /app/backend-bin; \
    else \
        cargo build --release && \
        strip target/release/backend && \
        cp target/release/backend /app/backend-bin; \
    fi

# =============================================================================
# Stage 3: Docker CLI & Compose plugin
# =============================================================================
FROM docker:27-cli AS docker-cli

# =============================================================================
# Stage 4: Minimal Lightweight Runtime Image (Target Architecture)
# =============================================================================
FROM debian:bookworm-slim

# Install strictly necessary runtime dependencies without recommended packages (no X11/ffmpeg bloat)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        libssl3 \
        sshpass \
        openssh-client \
        rclone \
        fuse3 && \
    apt-get clean && \
    rm -rf \
        /var/lib/apt/lists/* \
        /var/cache/apt/* \
        /tmp/* \
        /var/tmp/* \
        /usr/share/doc \
        /usr/share/man \
        /usr/share/locale \
        /usr/share/info

WORKDIR /app

# Copy compiled backend binary from builder
COPY --from=backend-builder /app/backend-bin /usr/local/bin/orbit-backend

# Copy Docker CLI & Compose plugin
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/
COPY --from=docker-cli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/

RUN chmod +x /usr/local/bin/orbit-backend /usr/local/bin/docker /usr/local/libexec/docker/cli-plugins/docker-compose

# Copy built frontend assets
COPY --from=frontend-builder /app/frontend/dist ./public

# Prepare data volume directory
RUN mkdir -p /app/data

EXPOSE 5172

ENV RUST_LOG=info
ENV PORT=5172

CMD ["orbit-backend"]
