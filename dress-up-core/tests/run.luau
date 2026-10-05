--!strict
-- Runs with the official Luau CLI: luau tests/run.luau
local RoundStateMachine = require("../src/shared/RoundStateMachine")
local Voting = require("../src/shared/Voting")
local ColorMath = require("../src/shared/ColorMath")

local passed, failed = 0, 0
local function test(name: string, fn: () -> ())
	local ok, err = pcall(fn)
	if ok then passed += 1; print("PASS  " .. name)
	else failed += 1; print("FAIL  " .. name .. "\n      " .. tostring(err)) end
end
local function eq(a: any, b: any, msg: string?)
	if a ~= b then error(`{msg or "expected equal"}: got {tostring(a)}, expected {tostring(b)}`, 2) end
end
local function near(a: number, b: number, msg: string?)
	if math.abs(a - b) > 1e-6 then error(`{msg or "expected near"}: got {a}, expected {b}`, 2) end
end

local CFG = { minPlayers = 2, lobbySeconds = 5, dressingSeconds = 10, walkSeconds = 3, podiumSeconds = 4 }
local function run(m: RoundStateMachine.Machine, seconds: number): { RoundStateMachine.Event }
	local all: { RoundStateMachine.Event } = {}
	for _ = 1, math.round(seconds * 10) do
		for _, e in m:update(0.1) do table.insert(all, e) end
	end
	return all
end

-- Round loop -----------------------------------------------------------
test("lobby waits for enough players", function()
	local m = RoundStateMachine.new(CFG)
	m:addPlayer(1)
	run(m, 60)
	eq(m.phase, "Lobby")
end)

test("full loop: lobby -> dressing -> each model walks once -> podium -> lobby", function()
	local m = RoundStateMachine.new(CFG)
	for id = 1, 3 do m:addPlayer(id) end
	local events = run(m, 5 + 10 + 3 * 3 + 4 + 0.5)
	local phases: { string } = {}
	local onStage: { number } = {}
	for _, e in events do
		if e.kind == "PhaseChanged" and e.phase then table.insert(phases, e.phase) end
		if e.kind == "OnStage" and e.playerId then table.insert(onStage, e.playerId) end
	end
	eq(table.concat(phases, ">"), "Dressing>Runway>Podium>Lobby")
	eq(table.concat(onStage, ","), "1,2,3")
end)

test("joining mid-round waits as a spectator", function()
	local m = RoundStateMachine.new(CFG)
	m:addPlayer(1); m:addPlayer(2)
	run(m, 6) -- now dressing
	m:addPlayer(3)
	eq(#m.contestants, 2, "late joiner is not a contestant")
	run(m, 10 + 9 + 4 + 6) -- next round's dressing
	eq(m.phase, "Dressing"); eq(#m.contestants, 3, "late joiner plays next round")
end)

test("a model leaving mid-runway doesn't skip the next model", function()
	local m = RoundStateMachine.new(CFG)
	for id = 1, 4 do m:addPlayer(id) end
	run(m, 15.5) -- runway, model 1 on stage
	run(m, 3)    -- model 2 on stage
	eq(m:onStage(), 2)
	m:removePlayer(1) -- someone who already walked leaves
	eq(m:onStage(), 2, "still model 2")
	local events = run(m, 3)
	eq(events[1].playerId, 3, "model 3 walks next")
end)

test("round aborts back to lobby if too few players remain", function()
	local m = RoundStateMachine.new(CFG)
	m:addPlayer(1); m:addPlayer(2)
	run(m, 6)
	local events = m:removePlayer(2)
	eq(events[1].kind, "RoundAborted"); eq(m.phase, "Lobby")
end)

-- Voting ---------------------------------------------------------------
test("no self votes, stars must be 1-5 whole numbers", function()
	local t = Voting.new({ 1, 2 })
	eq((t:cast(1, 1, 5)), false)
	eq((t:cast(2, 1, 6)), false)
	eq((t:cast(2, 1, 0)), false)
	eq((t:cast(2, 1, 4.5)), false)
	eq((t:cast(2, 9, 3)), false, "not a contestant")
	eq((t:cast(2, 1, 4)), true)
end)

test("a re-vote replaces the old one", function()
	local t = Voting.new({ 1, 2 })
	t:cast(2, 1, 1); t:cast(2, 1, 5)
	local r = t:results()
	eq(r[1].id, 1); eq(r[1].votes, 1); eq(r[1].score, 5)
end)

test("trimmed mean blunts one friend boost and one troll vote", function()
	local t = Voting.new({ 1, 2, 10, 11, 12, 13, 14, 15 })
	-- model 1: solid look, one troll gives 1
	for voter, s in { [10] = 4, [11] = 4, [12] = 4, [13] = 4, [14] = 1 } do t:cast(voter, 1, s) end
	-- model 2: weaker look, one friend gives 5
	for voter, s in { [10] = 3, [11] = 3, [12] = 3, [13] = 3, [15] = 5 } do t:cast(voter, 2, s) end
	local r = t:results()
	local byId = {}
	for _, x in r do byId[x.id] = x end
	eq(byId[1].raw, 3.4); eq(byId[2].raw, 3.4, "a plain average calls it a tie")
	eq(byId[1].score, 4); eq(byId[2].score, 3)
	eq(r[1].id, 1, "the better outfit wins")
end)

test("ties go to more votes, then runway order", function()
	local t = Voting.new({ 1, 2, 3 })
	t:cast(9, 2, 4); t:cast(8, 2, 4)
	t:cast(9, 3, 4)
	t:cast(9, 1, 4)
	local r = t:results()
	eq(r[1].id, 2, "more votes"); eq(r[2].id, 1, "earlier on runway"); eq(r[3].id, 3)
end)

-- Color ----------------------------------------------------------------
test("hsv -> rgb primaries", function()
	local r, g, b = ColorMath.hsvToRgb(0, 1, 1); near(r, 1); near(g, 0); near(b, 0)
	r, g, b = ColorMath.hsvToRgb(120, 1, 1); near(r, 0); near(g, 1); near(b, 0)
	r, g, b = ColorMath.hsvToRgb(240, 1, 0.5); near(r, 0); near(g, 0); near(b, 0.5)
	eq(ColorMath.toHex(ColorMath.hsvToRgb(330, 0.6, 1)), "#FF66B3")
end)

test("rgb -> hsv -> rgb round trip on 1,000 colors", function()
	local seed = 7
	local function rand() seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 end
	for _ = 1, 1000 do
		local r, g, b = rand(), rand(), rand()
		local h, s, v = ColorMath.rgbToHsv(r, g, b)
		local r2, g2, b2 = ColorMath.hsvToRgb(h, s, v)
		near(r, r2); near(g, g2); near(b, b2)
	end
end)

test("wheel: center is white, outside the ring clamps to full saturation", function()
	local _, s = ColorMath.wheelToHs(0, 0, 100); eq(s, 0)
	local h, s2 = ColorMath.wheelToHs(500, 0, 100); eq(s2, 1); near(h, 0)
	local h2 = ColorMath.wheelToHs(0, -100, 100); near(h2, 90) -- straight up is 90 degrees
end)

print(`\n{passed} passed, {failed} failed`)
if failed > 0 then error("tests failed") end
