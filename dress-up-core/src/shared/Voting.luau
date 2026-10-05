--!strict
-- Runway voting. Pure logic, validated on the server.
-- Rules: no self-votes, 1-5 stars, one vote per voter per model (a re-vote replaces the old one).
-- Score = trimmed mean once a model has 5+ votes (drops one highest and one lowest),
-- so a friend's 5 or a troll's 1 can't swing the podium on its own.

export type Result = { id: number, score: number, votes: number, raw: number }

local Voting = {}
Voting.__index = Voting

export type Tally = typeof(setmetatable({} :: {
	order: { number }, votes: { [number]: { [number]: number } },
}, Voting))

function Voting.new(contestants: { number }): Tally
	local votes = {}
	for _, id in contestants do votes[id] = {} end
	return setmetatable({ order = table.clone(contestants), votes = votes }, Voting)
end

function Voting.cast(self: Tally, voter: number, target: number, stars: number): (boolean, string?)
	if voter == target then return false, "self_vote" end
	local box = self.votes[target]
	if not box then return false, "not_a_contestant" end
	if typeof(stars) ~= "number" or stars ~= math.floor(stars) or stars < 1 or stars > 5 then
		return false, "bad_stars"
	end
	box[voter] = stars
	return true, nil
end

local function score(list: { number }): (number, number)
	local n = #list
	if n == 0 then return 0, 0 end
	local sum = 0
	for _, s in list do sum += s end
	local raw = sum / n
	if n < 5 then return raw, raw end
	table.sort(list)
	return (sum - list[1] - list[n]) / (n - 2), raw
end

function Voting.results(self: Tally): { Result }
	local out: { Result } = {}
	for _, id in self.order do
		local list = {}
		for _, s in self.votes[id] do table.insert(list, s) end
		local fair, raw = score(list)
		table.insert(out, { id = id, score = math.round(fair * 100) / 100, raw = math.round(raw * 100) / 100, votes = #list })
	end
	local pos: { [number]: number } = {}
	for i, id in self.order do pos[id] = i end
	table.sort(out, function(a: Result, b: Result): boolean
		if a.score ~= b.score then return a.score > b.score end
		if a.votes ~= b.votes then return a.votes > b.votes end
		return pos[a.id] < pos[b.id] -- earlier on the runway wins a full tie
	end)
	return out
end

return Voting
