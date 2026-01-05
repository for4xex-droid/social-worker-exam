FROM rust:1-alpine3.19 as builder
WORKDIR /app
RUN apk add --no-cache musl-dev

# 1. Dependency Caching
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release
RUN rm -rf src

# 2. Build App
COPY . .
RUN touch src/main.rs
RUN cargo build --release

# 3. Runner (Secure & Minimal)
FROM alpine:3.19
# 重要: CA証明書がないとHTTPSが失敗する
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=builder /app/target/release/rust-vibe-app .
CMD ["./rust-vibe-app"]
