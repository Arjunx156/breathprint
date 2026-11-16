set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command"]

default: check

# API on :8787 and the app on :5173
dev:
    bun run scripts/dev.ts

# Everything that must pass before a commit: lint, types, tests, build and budget
check:
    bun x biome check .
    bun x tsc --noEmit
    bun test
    bun run build

# Fix formatting and autofixable lint
fmt:
    bun x biome check --write .

test *args:
    bun test {{args}}

# Unit tests with line coverage
cover:
    bun test --coverage

# Build for Vercel into .vercel/output and check the JS budget
build:
    bun run build

# Serve the production build locally on :8787
start: build
    bun run start

# Browser tests with an accessibility scan on every route
e2e:
    bun x playwright test

# Score the model against evals/cases.jsonl (needs GEMINI_API_KEY)
eval:
    bun run evals/run.ts
