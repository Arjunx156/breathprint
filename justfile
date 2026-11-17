set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command"]

default: check

# API on :8787 and the app on :5173
dev:
    bun run scripts/dev.ts

# Everything that must pass before a commit: lint, types, tests, build, budget and eval replay
check:
    bun x biome check .
    bun x tsc --noEmit
    bun test
    bun run build
    bun run evals/run.ts --replay

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

# Score the model on evals/cases.ts and save its replies for replay (needs GEMINI_API_KEY)
eval:
    bun run evals/run.ts

# Save real answers for the demo day into server/ai/recorded.json (needs GEMINI_API_KEY)
record:
    bun run evals/record.ts
