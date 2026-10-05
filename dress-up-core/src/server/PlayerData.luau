--!strict
-- Saves currency, unlocked items, and stats.
-- Session lock: a profile can only be open on one server at a time, so a player who hops
-- servers fast can't load stale data and duplicate or lose unlocks.
-- (For a larger game I'd use ProfileStore, which does the same with more edge cases covered.)

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")

local store = DataStoreService:GetDataStore("PlayerData_v1")
local LOCK_TTL = 30 * 60 -- a crashed server's lock expires after 30 min

export type Profile = { coins: number, unlocked: { [string]: boolean }, stats: { rounds: number, wins: number } }

local function default(): Profile
	return { coins = 100, unlocked = { slip_dress = true }, stats = { rounds = 0, wins = 0 } }
end

local PlayerData = {}
local loaded: { [Player]: Profile } = {}

local function retry<T>(fn: () -> T, tries: number): (boolean, T?)
	for i = 1, tries do
		local ok, result = pcall(fn)
		if ok then return true, result end
		task.wait(2 ^ i) -- 2s, 4s, 8s...
	end
	return false, nil
end

function PlayerData.load(player: Player): Profile?
	local key = "u_" .. player.UserId
	local ok, data = retry(function()
		return store:UpdateAsync(key, function(old)
			old = old or { profile = default() }
			local lock = old.lock
			if lock and lock.job ~= game.JobId and os.time() - lock.time < LOCK_TTL then
				return nil -- another server holds it: cancel this write, try again shortly
			end
			old.lock = { job = game.JobId, time = os.time() }
			return old
		end)
	end, 5)
	if not ok or not data or (data.lock and data.lock.job ~= game.JobId) then
		player:Kick("Your data is still saving on another server. Please rejoin in a moment.")
		return nil
	end
	loaded[player] = data.profile
	return data.profile
end

function PlayerData.save(player: Player, release: boolean)
	local profile = loaded[player]
	if not profile then return end
	retry(function()
		return store:UpdateAsync("u_" .. player.UserId, function(old)
			if old and old.lock and old.lock.job ~= game.JobId then return nil end -- we lost the lock: never overwrite
			return { profile = profile, lock = if release then nil else { job = game.JobId, time = os.time() } }
		end)
	end, 3)
	if release then loaded[player] = nil end
end

function PlayerData.get(player: Player): Profile? return loaded[player] end

function PlayerData.addCoins(player: Player, amount: number)
	local p = loaded[player]
	if p then p.coins += amount end
end

function PlayerData.unlock(player: Player, itemId: string, price: number): boolean
	local p = loaded[player]
	if not p or p.unlocked[itemId] or p.coins < price then return false end
	p.coins -= price
	p.unlocked[itemId] = true
	return true
end

Players.PlayerRemoving:Connect(function(player) PlayerData.save(player, true) end)
game:BindToClose(function()
	for _, player in Players:GetPlayers() do task.spawn(PlayerData.save, player, true) end
	task.wait(3)
end)
task.spawn(function() -- autosave
	while true do
		task.wait(120)
		for player in loaded do task.spawn(PlayerData.save, player, false) end
	end
end)

return PlayerData
