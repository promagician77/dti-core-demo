--!strict
-- Wires the pure state machine and voting to Roblox: players, remotes, rewards.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local RoundStateMachine = require(ReplicatedStorage.Shared.RoundStateMachine)
local Voting = require(ReplicatedStorage.Shared.Voting)
local PlayerData = require(script.Parent.PlayerData)
local OutfitService = require(script.Parent.OutfitService)

local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local StateChanged = Remotes.StateChanged :: RemoteEvent
local CastVote = Remotes.CastVote :: RemoteEvent
local Equip = Remotes.Equip :: RemoteFunction
local Recolor = Remotes.Recolor :: RemoteFunction

local machine = RoundStateMachine.new({
	minPlayers = 2, lobbySeconds = 20, dressingSeconds = 360, walkSeconds = 10, podiumSeconds = 12,
})
local tally: Voting.Tally? = nil
local REWARDS = { 100, 60, 40 }
local PARTICIPATION = 10

local function broadcast(event)
	StateChanged:FireAllClients(event, machine.phase, machine.timeLeft, machine:onStage())
end

local function handle(events)
	for _, e in events do
		if e.kind == "PhaseChanged" and e.phase == "Dressing" then
			tally = Voting.new(machine.contestants)
		elseif e.kind == "PhaseChanged" and e.phase == "Podium" and tally then
			local results = tally:results()
			for place, r in results do
				local player = Players:GetPlayerByUserId(r.id)
				if player then
					PlayerData.addCoins(player, REWARDS[place] or PARTICIPATION)
					local data = PlayerData.get(player)
					if data then
						data.stats.rounds += 1
						if place == 1 then data.stats.wins += 1 end
					end
				end
			end
		elseif e.kind == "PhaseChanged" and e.phase == "Lobby" then
			for _, p in Players:GetPlayers() do OutfitService.clear(p) end
			tally = nil
		end
		broadcast(e)
	end
end

Players.PlayerAdded:Connect(function(player)
	if PlayerData.load(player) then machine:addPlayer(player.UserId) end
end)
Players.PlayerRemoving:Connect(function(player)
	handle(machine:removePlayer(player.UserId))
end)

-- Votes only count for the model currently on the runway.
CastVote.OnServerEvent:Connect(function(player, stars)
	local target = machine:onStage()
	if not tally or not target then return end
	tally:cast(player.UserId, target, stars)
end)

Equip.OnServerInvoke = function(player, itemId)
	return OutfitService.equip(player, itemId, machine.phase == "Dressing")
end
Recolor.OnServerInvoke = function(player, itemId, h, s, v)
	if machine.phase ~= "Dressing" then return false, "not_dressing_phase" end
	return OutfitService.recolor(player, itemId, h, s, v)
end

RunService.Heartbeat:Connect(function(dt)
	handle(machine:update(dt))
end)
