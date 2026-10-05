--!strict
-- Round loop as a pure state machine: Lobby -> Dressing -> Runway -> Podium -> Lobby.
-- No Roblox APIs here, so it runs (and is tested) outside Studio. RoundService drives it with Heartbeat dt.

export type Phase = "Lobby" | "Dressing" | "Runway" | "Podium"
export type Event = { kind: string, phase: Phase?, playerId: number?, reason: string? }
export type Config = {
	minPlayers: number, lobbySeconds: number, dressingSeconds: number,
	walkSeconds: number, podiumSeconds: number,
}

local RoundStateMachine = {}
RoundStateMachine.__index = RoundStateMachine

export type Machine = typeof(setmetatable({} :: {
	config: Config, phase: Phase, timeLeft: number,
	players: { [number]: boolean }, contestants: { number }, stageIndex: number,
}, RoundStateMachine))

function RoundStateMachine.new(config: Config): Machine
	return setmetatable({
		config = config, phase = "Lobby" :: Phase, timeLeft = config.lobbySeconds,
		players = {}, contestants = {}, stageIndex = 0,
	}, RoundStateMachine)
end

local function count(t: { [number]: boolean }): number
	local n = 0
	for _ in t do n += 1 end
	return n
end

function RoundStateMachine.addPlayer(self: Machine, id: number)
	-- Joining mid-round makes you a spectator until the next round starts.
	self.players[id] = true
end

function RoundStateMachine.removePlayer(self: Machine, id: number): { Event }
	self.players[id] = nil
	local events: { Event } = {}
	local idx = table.find(self.contestants, id)
	if idx then
		table.remove(self.contestants, idx)
		-- If the leaver was before the current model, the stage index shifts back.
		if self.phase == "Runway" and idx <= self.stageIndex then self.stageIndex -= 1 end
		if (self.phase == "Dressing" or self.phase == "Runway") and #self.contestants < self.config.minPlayers then
			table.insert(events, { kind = "RoundAborted", reason = "not_enough_players" })
			self:enter("Lobby", events)
		end
	end
	return events
end

function RoundStateMachine.enter(self: Machine, phase: Phase, events: { Event })
	self.phase = phase
	if phase == "Lobby" then
		self.timeLeft = self.config.lobbySeconds
		self.contestants = {}
		self.stageIndex = 0
	elseif phase == "Dressing" then
		self.timeLeft = self.config.dressingSeconds
		self.contestants = {}
		for id in self.players do table.insert(self.contestants, id) end
		table.sort(self.contestants)
	elseif phase == "Runway" then
		self.stageIndex = 1
		self.timeLeft = self.config.walkSeconds
	elseif phase == "Podium" then
		self.timeLeft = self.config.podiumSeconds
	end
	table.insert(events, { kind = "PhaseChanged", phase = phase })
	if phase == "Runway" then
		table.insert(events, { kind = "OnStage", playerId = self.contestants[1] })
	end
end

function RoundStateMachine.update(self: Machine, dt: number): { Event }
	local events: { Event } = {}
	if self.phase == "Lobby" and count(self.players) < self.config.minPlayers then
		self.timeLeft = self.config.lobbySeconds -- countdown waits for enough players
		return events
	end
	self.timeLeft -= dt
	if self.timeLeft > 0 then return events end

	if self.phase == "Lobby" then
		self:enter("Dressing", events)
	elseif self.phase == "Dressing" then
		self:enter("Runway", events)
	elseif self.phase == "Runway" then
		self.stageIndex += 1
		if self.stageIndex > #self.contestants then
			self:enter("Podium", events)
		else
			self.timeLeft = self.config.walkSeconds
			table.insert(events, { kind = "OnStage", playerId = self.contestants[self.stageIndex] })
		end
	elseif self.phase == "Podium" then
		self:enter("Lobby", events)
	end
	return events
end

function RoundStateMachine.onStage(self: Machine): number?
	if self.phase ~= "Runway" then return nil end
	return self.contestants[self.stageIndex]
end

return RoundStateMachine
