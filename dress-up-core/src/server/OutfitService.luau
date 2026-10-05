--!strict
-- Equip, recolor, and pattern changes. The client only asks; the server decides.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")

local Catalog = require(ReplicatedStorage.Shared.Catalog)
local ColorMath = require(ReplicatedStorage.Shared.ColorMath)
local PlayerData = require(script.Parent.PlayerData)

local OutfitService = {}
local MAX_ITEMS = 18
local worn: { [Player]: { [string]: Instance } } = {}
local lastCall: { [Player]: number } = {}

local function throttled(player: Player): boolean
	local now = os.clock()
	if lastCall[player] and now - lastCall[player] < 0.08 then return true end -- ~12 calls/s
	lastCall[player] = now
	return false
end

function OutfitService.equip(player: Player, itemId: string, canDress: boolean): (boolean, string?)
	if throttled(player) then return false, "slow_down" end
	if not canDress then return false, "not_dressing_phase" end
	local item = Catalog[itemId]
	if not item then return false, "unknown_item" end
	local data = PlayerData.get(player)
	if not data or (item.price > 0 and not data.unlocked[itemId]) then return false, "locked" end
	local char = player.Character
	local humanoid = char and char:FindFirstChildOfClass("Humanoid")
	if not humanoid then return false, "no_character" end
	worn[player] = worn[player] or {}
	local count = 0
	for _ in worn[player] do count += 1 end
	if count >= MAX_ITEMS then return false, "too_many_items" end

	if item.source == "Custom" then
		-- Our own layered accessory: cloned so each player gets an instance we can recolor.
		local template = ServerStorage.Clothing:FindFirstChild(item.template :: string)
		if not template then return false, "missing_template" end
		local acc = template:Clone()
		humanoid:AddAccessory(acc)
		worn[player][itemId] = acc
	else
		-- Marketplace layered clothing goes through HumanoidDescription.
		local desc = humanoid:GetAppliedDescription()
		local list = desc:GetAccessories(true)
		table.insert(list, { AssetId = item.assetId, AccessoryType = Enum.AccessoryType.Dress, IsLayered = true, Order = #list + 1 })
		desc:SetAccessories(list, true)
		humanoid:ApplyDescription(desc)
	end
	return true, nil
end

function OutfitService.recolor(player: Player, itemId: string, h: number, s: number, v: number): (boolean, string?)
	if throttled(player) then return false, "slow_down" end
	local item = Catalog[itemId]
	if not item or not item.recolorable then return false, "not_recolorable" end
	local acc = worn[player] and worn[player][itemId]
	local handle = acc and acc:FindFirstChild("Handle")
	if not handle or not handle:IsA("MeshPart") then return false, "not_worn" end
	if typeof(h) ~= "number" or typeof(s) ~= "number" or typeof(v) ~= "number" then return false, "bad_color" end
	local r, g, b = ColorMath.hsvToRgb(h, math.clamp(s, 0, 1), math.clamp(v, 0.08, 1)) -- no pure black voids
	handle.Color = Color3.new(r, g, b) -- shows through the texture's transparent regions
	return true, nil
end

function OutfitService.setPattern(player: Player, itemId: string, pattern: string): (boolean, string?)
	local item = Catalog[itemId]
	if not item or not item.patterns or not table.find(item.patterns, pattern) then return false, "bad_pattern" end
	local acc = worn[player] and worn[player][itemId]
	local handle = acc and acc:FindFirstChild("Handle")
	local look = handle and handle:FindFirstChild("SurfaceAppearance")
	local source = ServerStorage.Patterns:FindFirstChild(item.id .. "_" .. pattern)
	if not handle or not source then return false, "not_worn" end
	if look then look:Destroy() end
	source:Clone().Parent = handle
	return true, nil
end

function OutfitService.clear(player: Player)
	for _, acc in worn[player] or {} do acc:Destroy() end
	worn[player] = nil
end

Players.PlayerRemoving:Connect(function(p) worn[p] = nil; lastCall[p] = nil end)

return OutfitService
