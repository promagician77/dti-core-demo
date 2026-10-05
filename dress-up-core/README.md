# dress-up-core

Core systems for a Dress to Impress style Roblox game. Rojo project.

| Path | What it does |
|---|---|
| `src/shared/RoundStateMachine.luau` | Lobby → Dressing → Runway → Podium loop. Pure, no Roblox APIs, tested. |
| `src/shared/Voting.luau` | 1-5 star votes, no self-votes, re-votes replace, trimmed-mean scoring. Tested. |
| `src/shared/ColorMath.luau` | HSV/RGB conversion and wheel input math, shared by client and server. Tested. |
| `src/shared/Catalog.luau` | Item definitions. `recolorable` only for items built for it. |
| `src/server/PlayerData.luau` | DataStore save with session locking, retries, autosave, BindToClose. |
| `src/server/OutfitService.luau` | Server-validated equip, recolor, and pattern changes, with rate limiting. |
| `src/server/RoundService.server.luau` | Wires the round loop, votes, and rewards to players and remotes. |
| `src/client/ColorWheel.client.luau` | Color wheel input with instant local preview, sent to the server on release. |

## Run the tests (no Studio needed)
Download the Luau CLI from https://github.com/luau-lang/luau/releases, then:
```
luau tests/run.luau
luau-analyze src/shared/*.luau tests/run.luau
```

## Open in Studio
`rojo serve`, then connect from the Rojo plugin. Remotes (`StateChanged`, `CastVote`, `Equip`, `Recolor`) live in `ReplicatedStorage.Remotes`; clothing templates in `ServerStorage.Clothing`, pattern SurfaceAppearances in `ServerStorage.Patterns`.

## Why only some items are recolorable
A MeshPart's `Color` only shows through transparent regions of its texture. Items made for recoloring use textures with those regions left open. Marketplace UGC usually isn't made that way, so it keeps its own colors.
