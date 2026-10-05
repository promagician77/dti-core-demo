--!strict
-- Item definitions. `recolorable` is only true for items built for it:
-- our own meshes whose textures leave transparent regions, so the MeshPart's Color shows through.
-- Marketplace UGC is equipped through HumanoidDescription and keeps its own colors.

export type Item = {
	id: string, name: string, slot: string, price: number,
	source: "Custom" | "Marketplace", assetId: number?, template: string?,
	recolorable: boolean, patterns: { string }?,
}

local Catalog: { [string]: Item } = {
	slip_dress = { id = "slip_dress", name = "Slip Dress", slot = "Dress", price = 0, source = "Custom", template = "SlipDress", recolorable = true, patterns = { "Solid", "Polka", "Stripe", "Floral" } },
	puffer_jacket = { id = "puffer_jacket", name = "Puffer Jacket", slot = "Outerwear", price = 250, source = "Custom", template = "PufferJacket", recolorable = true, patterns = { "Solid", "Stripe" } },
	ugc_bag = { id = "ugc_bag", name = "Marketplace Bag", slot = "Accessory", price = 0, source = "Marketplace", assetId = 0, recolorable = false },
}

return Catalog
