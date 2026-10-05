--!strict
-- Color wheel: drag on the wheel image, preview locally at once, send to the server on release.
-- Local preview keeps it instant; the server applies the final color everyone else sees.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local ColorMath = require(ReplicatedStorage.Shared.ColorMath)
local Recolor = ReplicatedStorage:WaitForChild("Remotes"):WaitForChild("Recolor") :: RemoteFunction

local gui = Players.LocalPlayer:WaitForChild("PlayerGui"):WaitForChild("DressingRoom")
local wheel = gui.ColorPanel.Wheel :: ImageButton
local value = gui.ColorPanel.Value :: Frame -- brightness slider
local preview = gui.ColorPanel.Preview :: Frame

local selectedItem: string? = nil
local h, s, v = 0, 0, 1
local dragging = false

local function render()
	local r, g, b = ColorMath.hsvToRgb(h, s, v)
	preview.BackgroundColor3 = Color3.new(r, g, b)
end

local function fromInput(pos: Vector2)
	local center = wheel.AbsolutePosition + wheel.AbsoluteSize / 2
	h, s = ColorMath.wheelToHs(pos.X - center.X, pos.Y - center.Y, wheel.AbsoluteSize.X / 2)
	render()
end

wheel.InputBegan:Connect(function(input)
	if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
		dragging = true
		fromInput(Vector2.new(input.Position.X, input.Position.Y))
	end
end)
UserInputService.InputChanged:Connect(function(input)
	if dragging and (input.UserInputType == Enum.UserInputType.MouseMovement or input.UserInputType == Enum.UserInputType.Touch) then
		fromInput(Vector2.new(input.Position.X, input.Position.Y))
	end
end)
UserInputService.InputEnded:Connect(function(input)
	if dragging and (input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch) then
		dragging = false
		if selectedItem then Recolor:InvokeServer(selectedItem, h, s, v) end
	end
end)

gui.ColorPanel:GetAttributeChangedSignal("Item"):Connect(function()
	selectedItem = gui.ColorPanel:GetAttribute("Item")
end)

render()
