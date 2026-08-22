# Stage 1: Build the frontend (React/Vite)
# $BUILDPLATFORM = the runner's native platform (amd64) — fast npm build
FROM --platform=$BUILDPLATFORM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the backend (Rust)
# $BUILDPLATFORM = the runner's native platform for the toolchain
# $TARGETPLATFORM = the target arch (arm64 on Pi) — cargo cross-compiles via QEMU
FROM --platform=$BUILDPLATFORM rust:slim-bookworm AS backend-builder
# Install build dependencies (pkg-config and libssl-dev are often needed for networking crates)
RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# We create a dummy project to cache dependencies
RUN cargo new backend
WORKDIR /app/backend
COPY backend/Cargo.toml backend/Cargo.lock ./
# Build dependencies (this layer is cached)
RUN cargo build --release
# Remove the dummy src and copy actual source code
RUN rm src/*.rs
COPY backend/src ./src
COPY backend/tests ./tests
# Touch main.rs to ensure Cargo recompiles the bin
RUN touch src/main.rs
RUN cargo build --release

# Stage 3: Runtime image — use $TARGETPLATFORM so the binary runs on arm64
FROM --platform=$TARGETPLATFORM debian:bookworm-slim
# Install runtime dependencies for networking and CA certificates
RUN apt-get update && apt-get install -y ca-certificates libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the compiled backend binary
COPY --from=backend-builder /app/backend/target/release/backend /usr/local/bin/orbit-backend

# Install Docker CLI & Compose from the official image (must match TARGETPLATFORM)
COPY --from=docker:27-cli /usr/local/bin/docker /usr/local/bin/
COPY --from=docker:27-cli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/

# Copy the built frontend into the public directory (where ServeDir expects it)
COPY --from=frontend-builder /app/frontend/dist ./public

# Ensure the data directory exists
RUN mkdir -p /app/data

EXPOSE 5172

# Set environment variables for production
ENV RUST_LOG=info
ENV PORT=5172

CMD ["orbit-backend"]
