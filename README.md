# Dress-up game core — demo site + Luau source

- `index.html` — tabbed demo: round loop, color & pattern, runway voting, code & tests, delivery. The JS ports the same logic as the Luau modules.
- `dress-up-core/` — Rojo project with the Luau source and tests (see its README).

Deploy: `npm run deploy` (Vercel CLI) or import the repo in Vercel with the "Other" preset and no build command.
Run the Luau tests: `luau dress-up-core/tests/run.luau` (Luau CLI from github.com/luau-lang/luau/releases).
