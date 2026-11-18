# Security policy

Breathprint keeps no accounts and no database, and a household's profile never leaves the browser except as part of a request to the model. Even so, a hole is a hole, and I'd like to hear about it.

## Reporting

Please use GitHub's private vulnerability reporting on this repository (Security, then "Report a vulnerability"). Include the route or page, what you sent and what came back. I'll reply within a week and credit you in the fix unless you'd rather not be named.

Please don't open a public issue for a vulnerability, run load tests against the live site, or test with anyone's real data.

## Scope

In scope: the live site at https://breathprint-zeta.vercel.app, the API under `/api/`, and the code in this repository. Out of scope: Vercel, Google's Gemini API and Open-Meteo themselves, and rate limiting that works as documented in [docs/security.md](docs/security.md).

## Supported versions

Only the `main` branch, which is what the live site runs.
