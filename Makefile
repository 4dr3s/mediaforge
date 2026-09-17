.PHONY: install up down test test-api test-worker

install:
	pnpm install
	uv sync --project workers/media --extra dev

up:
	docker compose -f docker/compose.yaml up -d --wait

down:
	docker compose -f docker/compose.yaml down

test: test-api test-worker

# `--fail-if-no-match` is required, not decorative: plain `--filter <no-match>` exits 0, with
# `exec` and with `run` alike (defect D1). A gate that cannot fail is not a gate.
test-api:
	pnpm --filter api --fail-if-no-match run test:harness

test-worker:
	uv run --project workers/media pytest workers/media/tests/test_harness.py -q
