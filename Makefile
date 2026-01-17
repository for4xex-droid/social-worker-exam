.PHONY: dev test review fix clean docker

dev:
	@if command -v cargo-watch > /dev/null; then \
		RUST_LOG=info cargo watch -x check -x run; \
	else \
		echo "⚠️ Install cargo-watch: cargo install cargo-watch"; \
		cargo run; \
	fi

test:
	cargo test

review:
	cargo insta review

fix:
	cargo clippy --fix --allow-dirty --allow-staged
	cargo fmt

docker:
	docker build -t rust-vibe-app .
