.PHONY: build test test-watch test-coverage lint format typecheck clean

build:
	npx tsup

test:
	npx vitest run

test-watch:
	npx vitest

test-coverage:
	npx vitest run --coverage

lint:
	npx eslint src/

format:
	npx prettier --write src/ tests/

typecheck:
	npx tsc --noEmit

clean:
	rm -rf dist coverage
