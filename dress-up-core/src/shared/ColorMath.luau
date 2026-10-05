--!strict
-- Color wheel math. Shared by the client (wheel UI) and server (validating requested colors).

local ColorMath = {}

-- h in [0, 360), s and v in [0, 1] -> r, g, b in [0, 1]
function ColorMath.hsvToRgb(h: number, s: number, v: number): (number, number, number)
	h = h % 360
	local c = v * s
	local x = c * (1 - math.abs((h / 60) % 2 - 1))
	local m = v - c
	local r, g, b
	if h < 60 then r, g, b = c, x, 0
	elseif h < 120 then r, g, b = x, c, 0
	elseif h < 180 then r, g, b = 0, c, x
	elseif h < 240 then r, g, b = 0, x, c
	elseif h < 300 then r, g, b = x, 0, c
	else r, g, b = c, 0, x end
	return r + m, g + m, b + m
end

function ColorMath.rgbToHsv(r: number, g: number, b: number): (number, number, number)
	local max, min = math.max(r, g, b), math.min(r, g, b)
	local d = max - min
	local h = 0
	if d > 0 then
		if max == r then h = 60 * (((g - b) / d) % 6)
		elseif max == g then h = 60 * ((b - r) / d + 2)
		else h = 60 * ((r - g) / d + 4) end
	end
	local s = if max == 0 then 0 else d / max
	return h, s, max
end

-- A click on the wheel (relative to its center) -> hue and saturation.
-- Clicks outside the ring clamp to full saturation instead of jumping.
function ColorMath.wheelToHs(dx: number, dy: number, radius: number): (number, number)
	local dist = math.sqrt(dx * dx + dy * dy)
	local h = math.deg(math.atan2(-dy, dx)) % 360
	return h, math.clamp(dist / radius, 0, 1)
end

function ColorMath.toHex(r: number, g: number, b: number): string
	local function c(x: number): number return math.clamp(math.round(x * 255), 0, 255) end
	return string.format("#%02X%02X%02X", c(r), c(g), c(b))
end

return ColorMath
