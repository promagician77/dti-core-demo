# Dress-up game core — playable demo + Luau source

- `index.html` — a playable 3D round in the browser (three.js): Roblox-style R15 avatars, dressing room with layered outfits, color wheel and patterns, runway walk, star voting, podium and coin rewards. The round loop, vote rules, and color math (`logic.js`) are ports of the tested Luau modules.
- `dress-up-core/` — the Rojo project: Luau source and tests (see its README).

Run locally: `npm start`, then open http://localhost:3000
Deploy: `npm run deploy` (Vercel CLI), or import the repo in Vercel with the "Other" preset and no build command.
Luau tests: `luau dress-up-core/tests/run.luau` (Luau CLI from github.com/luau-lang/luau/releases).

three.js r128 (MIT) is bundled locally as `three.min.js`.
