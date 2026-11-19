set windows-shell := ["powershell.exe", "-NoLogo", "-NoProfile", "-Command"]

default: check

# API on :8787 and the app on :5173
dev:
    bun run scripts/dev.ts

# Everything that must pass before a commit: lint, types, unused code, tests and coverage, build, budget and eval replay
check:
    bun run check

# Fix formatting and autofixable lint
fmt:
    bun run format

# Files, exports and dependencies nothing uses
unused:
    bun run unused

test *args:
    bun test {{args}}

# Tests with coverage: 95% of lines overall, 98% of the shared engine, and no file left unloaded
cover:
    bun run coverage

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
