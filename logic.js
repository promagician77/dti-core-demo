// JS ports of the tested Luau modules (dress-up-core/src/shared). Same rules, same numbers.
(function (G) {
'use strict';
var ColorMath = {
  hsvToRgb: function (h, s, v) { h = ((h % 360) + 360) % 360; var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c, r, g, b;
    if (h < 60) { r = c; g = x; b = 0 } else if (h < 120) { r = x; g = c; b = 0 } else if (h < 180) { r = 0; g = c; b = x }
    else if (h < 240) { r = 0; g = x; b = c } else if (h < 300) { r = x; g = 0; b = c } else { r = c; g = 0; b = x }
    return [r + m, g + m, b + m] },
  wheelToHs: function (dx, dy, radius) { var d = Math.sqrt(dx * dx + dy * dy); var h = ((Math.atan2(-dy, dx) * 180 / Math.PI) % 360 + 360) % 360; return [h, Math.min(1, Math.max(0, d / radius))] },
  toHex: function (r, g, b) { var c = function (x) { return Math.min(255, Math.max(0, Math.round(x * 255))).toString(16).toUpperCase().padStart(2, '0') }; return '#' + c(r) + c(g) + c(b) },
  hex: function (h, s, v) { var c = ColorMath.hsvToRgb(h, s, v); return ColorMath.toHex(c[0], c[1], c[2]) }
};

function Machine(cfg) { this.cfg = cfg; this.phase = 'Lobby'; this.timeLeft = cfg.lobbySeconds; this.players = {}; this.contestants = []; this.stageIndex = 0 }
Machine.prototype.count = function () { return Object.keys(this.players).length };
Machine.prototype.addPlayer = function (id) { this.players[id] = true };
Machine.prototype.removePlayer = function (id) {
  delete this.players[id]; var ev = [], idx = this.contestants.indexOf(id);
  if (idx >= 0) { this.contestants.splice(idx, 1);
    if (this.phase === 'Runway' && idx + 1 <= this.stageIndex) this.stageIndex--;
    if ((this.phase === 'Dressing' || this.phase === 'Runway') && this.contestants.length < this.cfg.minPlayers) { ev.push({ kind: 'RoundAborted' }); this.enter('Lobby', ev) } }
  return ev };
Machine.prototype.enter = function (p, ev) { this.phase = p;
  if (p === 'Lobby') { this.timeLeft = this.cfg.lobbySeconds; this.contestants = []; this.stageIndex = 0 }
  else if (p === 'Dressing') { this.timeLeft = this.cfg.dressingSeconds; this.contestants = Object.keys(this.players).map(Number).sort(function (a, b) { return a - b }) }
  else if (p === 'Runway') { this.stageIndex = 1; this.timeLeft = this.cfg.walkSeconds }
  else if (p === 'Podium') { this.timeLeft = this.cfg.podiumSeconds }
  ev.push({ kind: 'PhaseChanged', phase: p }); if (p === 'Runway') ev.push({ kind: 'OnStage', playerId: this.contestants[0] }) };
Machine.prototype.update = function (dt) { var ev = [];
  if (this.phase === 'Lobby' && this.count() < this.cfg.minPlayers) { this.timeLeft = this.cfg.lobbySeconds; return ev }
  this.timeLeft -= dt; if (this.timeLeft > 0) return ev;
  if (this.phase === 'Lobby') this.enter('Dressing', ev);
  else if (this.phase === 'Dressing') this.enter('Runway', ev);
  else if (this.phase === 'Runway') { this.stageIndex++; if (this.stageIndex > this.contestants.length) this.enter('Podium', ev); else { this.timeLeft = this.cfg.walkSeconds; ev.push({ kind: 'OnStage', playerId: this.contestants[this.stageIndex - 1] }) } }
  else if (this.phase === 'Podium') this.enter('Lobby', ev);
  return ev };
Machine.prototype.onStage = function () { return this.phase === 'Runway' ? this.contestants[this.stageIndex - 1] : null };

function Tally(order) { this.order = order.slice(); this.votes = {}; var v = this.votes; order.forEach(function (id) { v[id] = {} }) }
Tally.prototype.cast = function (voter, target, stars) {
  if (voter === target) return [false, 'self_vote']; var box = this.votes[target]; if (!box) return [false, 'not_a_contestant'];
  if (typeof stars !== 'number' || stars !== Math.floor(stars) || stars < 1 || stars > 5) return [false, 'bad_stars'];
  box[voter] = stars; return [true, null] };
Tally.prototype.results = function () { var self = this, out = [], pos = {};
  this.order.forEach(function (id, i) { pos[id] = i; var list = Object.values(self.votes[id]); var n = list.length, sum = list.reduce(function (a, b) { return a + b }, 0);
    var raw = n ? sum / n : 0, fair = raw; if (n >= 5) { list.sort(function (a, b) { return a - b }); fair = (sum - list[0] - list[n - 1]) / (n - 2) }
    out.push({ id: id, score: Math.round(fair * 100) / 100, raw: Math.round(raw * 100) / 100, votes: n }) });
  out.sort(function (a, b) { return b.score - a.score || b.votes - a.votes || pos[a.id] - pos[b.id] }); return out };

function rng(seed) { var a = seed >>> 0; var f = function () { a = (a + 0x6d2b79f5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
  f.int = function (lo, hi) { return lo + Math.floor(f() * (hi - lo + 1)) }; f.pick = function (arr) { return arr[Math.floor(f() * arr.length)] }; return f }

G.DUP = { ColorMath: ColorMath, Machine: Machine, Tally: Tally, rng: rng };
})(window);
