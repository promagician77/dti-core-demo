// Playable 3D round: Roblox-style R15 avatars, runway, dressing room UI, star voting, podium.
// Round flow, vote rules, and color math come from logic.js (ports of the tested Luau modules).
(function () {
'use strict';
var D = window.DUP, CM = D.ColorMath, $ = function (id) { return document.getElementById(id) };
var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) };

// ================= catalog =================
var CAT = {
  Outfits: [
    { id: 'slip', name: 'Slip Dress', kind: 'dress', len: 1.55, flare: 1.5, price: 0, recolor: true, pats: ['Solid', 'Polka', 'Stripe', 'Floral'], c: [330, .6, 1, 'Solid'] },
    { id: 'gown', name: 'Ball Gown', kind: 'dress', len: 2.35, flare: 2.25, price: 150, recolor: true, pats: ['Solid', 'Floral'], c: [275, .5, .92, 'Solid'] },
    { id: 'mini', name: 'Mini Set', kind: 'mini', price: 0, recolor: true, pats: ['Solid', 'Stripe', 'Polka'], c: [48, .75, 1, 'Solid'] },
    { id: 'casual', name: 'Tee & Jeans', kind: 'casual', price: 0, recolor: true, pats: ['Solid', 'Stripe'], c: [0, 0, 1, 'Solid'] }
  ],
  Layers: [
    { id: 'puffer', name: 'Puffer Jacket', kind: 'puffer', price: 0, recolor: true, pats: ['Solid', 'Stripe'], c: [205, .45, .95, 'Solid'], layer: true }
  ],
  Hair: [
    { id: 'waves', name: 'Long Waves', kind: 'hair', price: 0, recolor: true, pats: [], c: [25, .65, .32, 'Solid'] },
    { id: 'buns', name: 'Space Buns', kind: 'hair', price: 0, recolor: true, pats: [], c: [330, .55, .85, 'Solid'] },
    { id: 'bob', name: 'Sleek Bob', kind: 'hair', price: 0, recolor: true, pats: [], c: [0, 0, .12, 'Solid'] }
  ],
  Accessories: [
    { id: 'bag', name: 'Shoulder Bag', kind: 'bag', price: 0, recolor: true, pats: ['Solid', 'Polka'], c: [15, .55, .55, 'Solid'] },
    { id: 'star', name: 'Star Headband', kind: 'star', price: 0, recolor: false, ugc: true, pats: [], c: [45, .75, .98, 'Solid'] }
  ],
  Makeup: [
    { id: 'rose', name: 'Rose Lips', kind: 'lips', hex: '#D9467A' }, { id: 'berry', name: 'Berry Lips', kind: 'lips', hex: '#8E1F4A' },
    { id: 'coral', name: 'Coral Lips', kind: 'lips', hex: '#F07A5A' }, { id: 'nude', name: 'Nude Lips', kind: 'lips', hex: '#C98B7A' }
  ]
};
var BYID = {}; Object.keys(CAT).forEach(function (k) { CAT[k].forEach(function (it) { it.cat = k; BYID[it.id] = it }) });
var THEMES = [
  { name: 'Y2K Pop Star', hues: [315, 285], likes: ['mini', 'Polka', 'star'] },
  { name: 'Beach Day', hues: [195, 50], likes: ['mini', 'Stripe', 'bag'] },
  { name: 'Winter Formal', hues: [210, 0], likes: ['gown', 'puffer'] },
  { name: 'Garden Party', hues: [120, 330], likes: ['slip', 'Floral', 'bag'] }
];
var SKIN = ['#F6D7C3', '#E8B894', '#C68863', '#8D5A3B', '#F1C9A5'];
var PEOPLE = [{ id: 1, name: 'Ava' }, { id: 2, name: 'Mia' }, { id: 3, name: 'You', me: true }, { id: 4, name: 'Zoe' }, { id: 5, name: 'Lia' }];
var ME = 3;

function piece(id, over) { var it = BYID[id]; var p = { id: id, h: it.c[0], s: it.c[1], v: it.c[2], p: it.c[3] }; if (over) Object.assign(p, over); return p }
function defaultLook() { return { outfit: piece('casual'), layer: null, hair: piece('waves'), bag: null, star: false, lips: '#D9467A' } }

// ================= three.js scene =================
var host = $('gview'), W = 0, H = 0;
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
host.appendChild(renderer.domElement);
var scene = new THREE.Scene();
scene.background = new THREE.Color('#2A1433'); scene.fog = new THREE.Fog('#2A1433', 30, 70);
var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
var camPos = new THREE.Vector3(0, 9, 24), camLook = new THREE.Vector3(0, 2, -2), camPosT = camPos.clone(), camLookT = camLook.clone();

scene.add(new THREE.HemisphereLight('#FFE4F1', '#2A1433', 0.75));
scene.add(new THREE.AmbientLight('#ffffff', 0.18));
function spot(x, y, z, tx, tz, color, inten) { var s = new THREE.SpotLight(color, inten, 60, Math.PI / 6, 0.45, 1.2); s.position.set(x, y, z); s.target.position.set(tx, 0, tz); s.castShadow = !spot.used; spot.used = true; s.shadow.mapSize.set(1024, 1024); scene.add(s); scene.add(s.target); return s }
spot(-7, 16, 10, 0, 0, '#ffffff', 1.25); spot(7, 16, 10, 0, -4, '#FFD1E8', 1.05); spot(0, 18, -4, 0, -8, '#E9D5FF', 0.8);

var mat = function (c, o) { return new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6, metalness: 0.05 }, o || {})) };
var floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat('#3A1D45', { roughness: 0.35 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.4; floor.receiveShadow = true; scene.add(floor);
var runway = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.4, 21), mat('#F8F1F6', { roughness: 0.22, metalness: 0.08 })); runway.position.set(0, -0.2, -3.5); runway.receiveShadow = true; scene.add(runway);
[-2.4, 2.4].forEach(function (x) { var s = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 21), mat('#FF4FA3', { emissive: '#FF2E92', emissiveIntensity: 1.4 })); s.position.set(x, 0.02, -3.5); scene.add(s) });
for (var i = 0; i < 9; i++) { var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat('#FFF', { emissive: '#FFE8F4', emissiveIntensity: 2 })); bulb.position.set(i % 2 ? 2.6 : -2.6, 0.18, 6 - i * 2.4); scene.add(bulb) }

function canvasTex(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t }
var backdropCanvas = document.createElement('canvas'); backdropCanvas.width = 1024; backdropCanvas.height = 512;
var backdropTex = new THREE.CanvasTexture(backdropCanvas); backdropTex.encoding = THREE.sRGBEncoding;
function drawBackdrop(theme) { var g = backdropCanvas.getContext('2d'), w = 1024, h = 512;
  var grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#5B1E66'); grd.addColorStop(1, '#2A1433'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
  for (var i = 0; i < 70; i++) { g.fillStyle = 'rgba(255,214,236,' + (0.15 + (i % 5) * 0.08) + ')'; g.beginPath(); g.arc((i * 137) % w, (i * 71) % h, 1.5 + (i % 3), 0, 7); g.fill() }
  g.textAlign = 'center'; g.fillStyle = '#FFD6EC'; g.font = '700 46px Fredoka, Arial Rounded MT Bold, Arial'; g.fillText('✦ RUNWAY ✦', w / 2, 120);
  g.fillStyle = '#ffffff'; g.font = '700 30px Fredoka, Arial'; g.fillText(theme ? 'THEME' : 'NEXT ROUND', w / 2, 230);
  g.fillStyle = '#FF7AC0'; g.font = '700 82px Fredoka, Arial Rounded MT Bold, Arial'; g.fillText(theme ? theme.toUpperCase() : 'STARTING SOON', w / 2, 320);
  backdropTex.needsUpdate = true }
drawBackdrop(null);
var backdrop = new THREE.Mesh(new THREE.PlaneGeometry(26, 13), new THREE.MeshStandardMaterial({ map: backdropTex, emissive: '#ffffff', emissiveMap: backdropTex, emissiveIntensity: 0.55, roughness: 0.9 }));
backdrop.position.set(0, 5.6, -15); scene.add(backdrop);
var frame = new THREE.Mesh(new THREE.BoxGeometry(26.6, 13.6, 0.3), mat('#FF4FA3', { emissive: '#B0125F', emissiveIntensity: 0.8 })); frame.position.set(0, 5.6, -15.2); scene.add(frame);

// podium
var podium = new THREE.Group(); scene.add(podium); podium.visible = false;
[[0, 1.7, 1, '#F5C542'], [-2.7, 1.15, 2, '#D9D9E3'], [2.7, 0.75, 3, '#E0A36B']].forEach(function (p) {
  var t = canvasTex(256, 256, function (g, w, h) { g.fillStyle = p[3]; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; g.font = '700 150px Fredoka, Arial'; g.textAlign = 'center'; g.fillText(String(p[2]), w / 2, 190) });
  var b = new THREE.Mesh(new THREE.BoxGeometry(2.5, p[1], 2.2), [mat(p[3]), mat(p[3]), mat(p[3]), mat(p[3]), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }), mat(p[3])]);
  b.position.set(p[0], p[1] / 2 - 0.0, -6); b.castShadow = true; b.receiveShadow = true; podium.add(b) });
var pedestal = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 0.35, 40), mat('#FCE7F3', { roughness: 0.3 })); pedestal.position.set(0, 0.17, 3); pedestal.receiveShadow = true; scene.add(pedestal); pedestal.visible = false;

// confetti
var confetti = []; var confettiGeo = new THREE.PlaneGeometry(0.18, 0.1);
function burst() { for (var i = 0; i < 160; i++) { var m = new THREE.Mesh(confettiGeo, new THREE.MeshBasicMaterial({ color: ['#FF4FA3', '#F5C542', '#7C3AED', '#38BDF8', '#ffffff'][i % 5], side: THREE.DoubleSide }));
  m.position.set((Math.random() - 0.5) * 10, 9 + Math.random() * 4, -6 + (Math.random() - 0.5) * 4); m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 0.6, -1.5 - Math.random() * 1.5, 0); m.userData.r = Math.random() * 5; scene.add(m); confetti.push(m) } }

// ================= avatars =================
var fabricCache = {};
function fabric(h, s, v, pat, extra) {
  var key = [Math.round(h), s.toFixed(2), v.toFixed(2), pat, extra || ''].join('|'); if (fabricCache[key]) return fabricCache[key];
  var base = CM.hex(h, s, v);
  var tex = canvasTex(128, 128, function (g, w) { g.fillStyle = base; g.fillRect(0, 0, w, w);
    var light = v < 0.45 ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.72)';
    if (pat === 'Polka') { g.fillStyle = light; for (var y = 0; y < 4; y++) for (var x = 0; x < 4; x++) { g.beginPath(); g.arc(x * 32 + (y % 2) * 16 + 8, y * 32 + 16, 6, 0, 7); g.fill() } }
    if (pat === 'Stripe') { g.fillStyle = light; for (var i = 0; i < 4; i++) g.fillRect(0, i * 32 + 4, w, 12) }
    if (pat === 'Floral') { for (var j = 0; j < 4; j++) { var cx = (j % 2) * 64 + 32, cy = Math.floor(j / 2) * 64 + 32; g.fillStyle = light; [[0, -9], [9, 0], [0, 9], [-9, 0]].forEach(function (o) { g.beginPath(); g.arc(cx + o[0], cy + o[1], 8, 0, 7); g.fill() }); g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.arc(cx, cy, 5, 0, 7); g.fill() } }
    if (extra === 'quilt') { g.fillStyle = 'rgba(0,0,0,.14)'; for (var k = 0; k < 4; k++) g.fillRect(0, k * 32 + 28, w, 4) } });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 2);
  return (fabricCache[key] = new THREE.MeshStandardMaterial({ map: tex, roughness: extra === 'quilt' ? 0.55 : 0.68 })) }

function faceTexture(lips) { return canvasTex(128, 128, function (g) {
  g.clearRect(0, 0, 128, 128); g.fillStyle = '#231A1E';
  g.beginPath(); g.ellipse(44, 54, 7, 10, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(84, 54, 7, 10, 0, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(46, 50, 2.6, 0, 7); g.fill(); g.beginPath(); g.arc(86, 50, 2.6, 0, 7); g.fill();
  g.strokeStyle = '#231A1E'; g.lineWidth = 3; g.beginPath(); g.moveTo(36, 40); g.lineTo(31, 36); g.moveTo(92, 40); g.lineTo(97, 36); g.stroke();
  g.fillStyle = 'rgba(255,120,150,.35)'; g.beginPath(); g.ellipse(32, 72, 9, 5, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(96, 72, 9, 5, 0, 0, 7); g.fill();
  g.fillStyle = lips; g.beginPath(); g.moveTo(52, 82); g.quadraticCurveTo(64, 96, 76, 82); g.quadraticCurveTo(64, 87, 52, 82); g.fill() }) }

function box(w, h, d, m) { var b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.castShadow = true; return b }

function makeAvatar(person, skin) {
  var g = new THREE.Group(), skinM = mat(skin, { roughness: 0.75 });
  var lower = box(2, 0.42, 1, skinM); lower.position.y = 2.26; g.add(lower);
  var upper = box(2, 1.6, 1, skinM); upper.position.y = 3.25; g.add(upper);
  var head = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 1.18, 28), skinM); head.position.y = 4.62; head.castShadow = true; g.add(head);
  var cap = new THREE.Mesh(new THREE.SphereGeometry(0.64, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2), skinM); cap.scale.y = 0.35; cap.position.y = 5.21; g.add(cap);
  var faceM = new THREE.MeshStandardMaterial({ map: faceTexture('#D9467A'), transparent: true, roughness: 0.8 });
  var face = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05), faceM); face.position.set(0, 4.62, 0.645); g.add(face);
  function limb(x, y, w, h) { var piv = new THREE.Group(); piv.position.set(x, y, 0); var m = box(w, h, w, skinM); m.position.y = -h / 2; piv.add(m); g.add(piv); return piv }
  var armL = limb(-1.5, 4.0, 0.92, 1.95), armR = limb(1.5, 4.0, 0.92, 1.95), legL = limb(-0.5, 2.06, 0.98, 2.02), legR = limb(0.5, 2.06, 0.98, 2.02);
  var cloth = new THREE.Group(); g.add(cloth);
  var tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(256, 64, function (c) { c.font = '700 34px Fredoka, Arial'; c.textAlign = 'center'; c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeText(person.name, 128, 44); c.fillStyle = person.me ? '#FFD6EC' : '#fff'; c.fillText(person.name, 128, 44) }), depthTest: false }));
  tag.scale.set(2.6, 0.65, 1); tag.position.y = 6.15; g.add(tag);
  g.userData = { person: person, faceM: faceM, armL: armL, armR: armR, legL: legL, legR: legR, cloth: cloth, sleeves: [], phase: Math.random() * 6 };
  g.traverse(function (o) { if (o.isMesh) o.castShadow = true });
  return g }

function clearCloth(av) { var u = av.userData; u.cloth.clear(); u.sleeves.forEach(function (s) { s.parent && s.parent.remove(s) }); u.sleeves = [] }
function sleeve(av, side, m, len, w) { var piv = side < 0 ? av.userData.armL : av.userData.armR; var s = box(w || 1.0, len, w || 1.0, m); s.position.y = -len / 2 + 0.02; piv.add(s); av.userData.sleeves.push(s) }
function legwear(av, m, len) { [av.userData.legL, av.userData.legR].forEach(function (piv) { var s = box(1.04, len, 1.04, m); s.position.y = -len / 2; piv.add(s); av.userData.sleeves.push(s) }) }

function dressUp(av, look) {
  clearCloth(av); var c = av.userData.cloth, o = look.outfit, it = BYID[o.id];
  var main = fabric(o.h, o.s, o.v, o.p);
  if (it.kind === 'dress') {
    var bod = box(2.08, 1.64, 1.08, main); bod.position.y = 3.25; c.add(bod);
    var skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.08, it.flare, it.len, 32), main); skirt.position.y = 2.47 - it.len / 2; skirt.castShadow = true; c.add(skirt);
    if (it.id === 'gown') { var bow = box(2.12, 0.22, 1.12, fabric(o.h, Math.min(1, o.s + 0.2), o.v * 0.8, 'Solid')); bow.position.y = 2.48; c.add(bow) }
  } else if (it.kind === 'mini') {
    var top = box(2.08, 0.95, 1.08, main); top.position.y = 3.56; c.add(top);
    var sk = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.38, 0.95, 32), main); sk.position.y = 2.0; sk.castShadow = true; c.add(sk);
  } else {
    var tee = box(2.08, 1.64, 1.08, main); tee.position.y = 3.25; c.add(tee);
    var denim = fabric(222, 0.55, 0.62, 'Solid'); var lowerJ = box(2.06, 0.46, 1.06, denim); lowerJ.position.y = 2.26; c.add(lowerJ);
    sleeve(av, -1, main, 0.7); sleeve(av, 1, main, 0.7); legwear(av, denim, 2.0);
  }
  if (look.layer) { var l = look.layer, pm = fabric(l.h, l.s, l.v, l.p, 'quilt');
    var jacket = box(2.45, 1.8, 1.45, pm); jacket.position.y = 3.2; c.add(jacket);
    var collar = box(2.2, 0.32, 1.3, pm); collar.position.y = 4.12; c.add(collar);
    sleeve(av, -1, pm, 1.75, 1.12); sleeve(av, 1, pm, 1.75, 1.12) }
  var hr = look.hair, hm = fabric(hr.h, hr.s, hr.v, 'Solid');
  var capH = new THREE.Mesh(new THREE.SphereGeometry(0.72, 28, 14, 0, Math.PI * 2, 0, Math.PI / 1.9), hm); capH.position.y = 4.95; capH.scale.set(1, 0.62, 1); capH.castShadow = true; c.add(capH);
  if (hr.id === 'waves') { var back = box(1.36, 2.1, 0.42, hm); back.position.set(0, 4.15, -0.5); c.add(back); [-0.62, 0.62].forEach(function (x) { var lk = box(0.3, 1.6, 0.55, hm); lk.position.set(x, 4.3, 0.12); c.add(lk) }) }
  if (hr.id === 'buns') { [-0.5, 0.5].forEach(function (x) { var b = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 14), hm); b.position.set(x, 5.55, -0.05); b.castShadow = true; c.add(b) }); var nape = box(1.3, 0.9, 0.36, hm); nape.position.set(0, 4.75, -0.5); c.add(nape) }
  if (hr.id === 'bob') { var bk = box(1.4, 1.05, 0.45, hm); bk.position.set(0, 4.62, -0.45); c.add(bk); [-0.66, 0.66].forEach(function (x) { var s = box(0.26, 0.95, 0.75, hm); s.position.set(x, 4.62, 0.05); c.add(s) }); var fr = box(1.3, 0.22, 0.2, hm); fr.position.set(0, 5.08, 0.6); c.add(fr) }
  if (look.bag) { var bgm = fabric(look.bag.h, look.bag.s, look.bag.v, look.bag.p); var bag = box(0.75, 0.62, 0.32, bgm); bag.position.set(1.32, 2.35, 0.25); c.add(bag);
    var strap = box(0.12, 2.6, 0.08, bgm); strap.position.set(0.25, 3.35, 0.56); strap.rotation.z = -0.62; c.add(strap) }
  if (look.star) { var gold = mat('#F5C542', { metalness: 0.55, roughness: 0.3, emissive: '#7A5A00', emissiveIntensity: 0.25 });
    var band = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.07, 10, 40), gold); band.rotation.x = Math.PI / 2.4; band.position.set(0, 5.1, 0.05); c.add(band);
    var sh = new THREE.Shape(); for (var k = 0; k < 10; k++) { var r = k % 2 ? 0.17 : 0.4, a = k / 10 * Math.PI * 2 - Math.PI / 2; k ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r) }
    var star = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false }), gold); star.position.set(0.42, 5.55, 0.32); star.rotation.z = Math.PI; c.add(star) }
  av.userData.faceM.map = faceTexture(look.lips); av.userData.faceM.needsUpdate = true;
  av.traverse(function (o2) { if (o2.isMesh) o2.castShadow = true }) }

// ================= game state =================
var CFG = { minPlayers: 2, lobbySeconds: 4, dressingSeconds: 75, walkSeconds: 5, podiumSeconds: 9 };
var machine = new D.Machine(CFG), tally = null, theme = null, coins = 250, owned = { slip: 1, mini: 1, casual: 1, puffer: 1, waves: 1, buns: 1, bob: 1, bag: 1, star: 1 };
var looks = {}, avatars = {}, roundNo = 0, rand = D.rng(20261005), pending = [], lastResults = null, started = false;
var cat = 'Outfits', selected = 'outfit';
PEOPLE.forEach(function (p, i) { looks[p.id] = defaultLook(); var av = makeAvatar(p, SKIN[i]); avatars[p.id] = av; scene.add(av); dressUp(av, looks[p.id]) });
window.DTI_GAME = { events: [], onRound: null };

function lineup() { PEOPLE.forEach(function (p, i) { var av = avatars[p.id]; av.visible = true; av.position.set((i - 2) * 3.2, 0, 2); av.rotation.set(0, 0, 0); av.userData.walk = null }) }
lineup();

function npcLook() {
  var o = rand.pick(CAT.Outfits.filter(function (x) { return x.id !== 'casual' || rand() < 0.2 }));
  var bias = rand() < 0.55 && theme ? theme.hues[rand.int(0, 1)] : rand.int(0, 359);
  var look = { outfit: piece(o.id, { h: (bias + rand.int(-18, 18) + 360) % 360, s: 0.35 + rand() * 0.55, v: 0.7 + rand() * 0.3, p: rand.pick(o.pats) }),
    layer: rand() < 0.3 ? piece('puffer', { h: rand.int(0, 359), s: 0.3 + rand() * 0.4 }) : null,
    hair: piece(rand.pick(['waves', 'buns', 'bob']), { h: rand.pick([20, 35, 0, 330, 270]), s: 0.3 + rand() * 0.5, v: 0.15 + rand() * 0.75 }),
    bag: rand() < 0.4 ? piece('bag', { h: rand.int(0, 359) }) : null, star: rand() < 0.25, lips: rand.pick(CAT.Makeup).hex };
  return look }

// How NPC judges see a look: theme colors, matching pieces, and layering.
function lookQuality(look) {
  var q = 2.3, o = look.outfit, d = Math.min.apply(null, theme.hues.map(function (h) { var x = Math.abs(o.h - h) % 360; return Math.min(x, 360 - x) }));
  if (o.s > 0.2) q += d < 25 ? 1.3 : d < 50 ? 0.6 : 0;
  var tags = [o.id, o.p, look.layer && 'puffer', look.bag && 'bag', look.star && 'star'];
  tags.forEach(function (t) { if (t && theme.likes.indexOf(t) >= 0) q += 0.45 });
  var pieces = [look.layer, look.bag, look.star].filter(Boolean).length; q += Math.min(pieces, 2) * 0.25;
  if (o.id === 'casual') q -= 0.8;
  return q }

function log(text) { window.DTI_GAME.events.unshift(text); if (window.DTI_GAME.events.length > 60) window.DTI_GAME.events.pop() }
function toast(t) { var el = $('gtoast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(function () { el.classList.remove('on') }, 2200) }

function handle(evs) {
  evs.forEach(function (e) {
    if (e.kind === 'PhaseChanged') {
      log('Phase → ' + e.phase);
      if (e.phase === 'Dressing') {
        roundNo++; theme = THEMES[(roundNo - 1) % THEMES.length]; drawBackdrop(theme.name); tally = new D.Tally(machine.contestants);
        PEOPLE.forEach(function (p) { if (!p.me) { looks[p.id] = npcLook(); dressUp(avatars[p.id], looks[p.id]) } });
        PEOPLE.forEach(function (p) { avatars[p.id].visible = !!p.me }); var me = avatars[ME]; me.position.set(0, 0.35, 3); me.rotation.y = 0; pedestal.visible = true; podium.visible = false;
        renderInventory(); renderPicker();
      }
      if (e.phase === 'Runway') { pedestal.visible = false; PEOPLE.forEach(function (p, i) { var av = avatars[p.id]; av.visible = true; var side = i % 2 ? 1 : -1; av.position.set(side * 7.2, 0, 3 - Math.floor(i / 2) * 4.6); av.rotation.y = -side * Math.PI / 2; av.userData.spot = { p: av.position.clone(), r: av.rotation.y } }) }
      if (e.phase === 'Podium') {
        var res = tally.results(); lastResults = res.map(function (r) { return Object.assign({ name: nameOf(r.id) }, r) });
        PEOPLE.forEach(function (p) { avatars[p.id].visible = false });
        var spots = [[0, 1.7], [-2.7, 1.15], [2.7, 0.75]]; podium.visible = true;
        res.slice(0, 3).forEach(function (r, i) { var av = avatars[r.id]; av.visible = true; endWalk(av); av.userData.spot = null; av.position.set(spots[i][0], spots[i][1], -6); av.rotation.y = 0 });
        var place = res.findIndex(function (r) { return r.id === ME }) + 1, reward = [100, 60, 40][place - 1] || 10; coins += reward;
        showResults(res, place, reward); burst(); log('Podium: ' + res.slice(0, 3).map(function (r) { return nameOf(r.id) }).join(', ') + ' · you placed #' + place + ', +' + reward + ' coins');
        if (window.DTI_GAME.onRound) window.DTI_GAME.onRound(lastResults, theme.name);
      }
      if (e.phase === 'Lobby') { drawBackdrop(null); podium.visible = false; lineup(); PEOPLE.forEach(function (p) { if (!p.me) { looks[p.id] = defaultLook(); looks[p.id].hair = piece(['waves', 'buns', 'bob'][p.id % 3]); dressUp(avatars[p.id], looks[p.id]) } }) }
      renderHud();
    }
    if (e.kind === 'OnStage') {
      PEOPLE.forEach(function (p) { if (avatars[p.id].userData.walk) endWalk(avatars[p.id]) }); var av = avatars[e.playerId]; av.userData.walk = { t: 0 }; av.position.set(0, 0, -12); av.rotation.y = 0; log(nameOf(e.playerId) + ' walks the runway');
      var q = lookQuality(looks[e.playerId]);
      PEOPLE.forEach(function (p) { if (!p.me && p.id !== e.playerId) pending.push({ at: 1 + rand() * 2.4, voter: p.id, target: e.playerId, stars: Math.max(1, Math.min(5, Math.round(q + (rand() - 0.5) * 1.6))) }) });
      [101, 102].forEach(function (aud) { pending.push({ at: 1.5 + rand() * 2, voter: aud, target: e.playerId, stars: Math.max(1, Math.min(5, Math.round(q + (rand() - 0.5) * 2))) }) });
      myVote = 0; renderRate();
    }
  }) }
function nameOf(id) { var p = PEOPLE.filter(function (x) { return x.id === id })[0]; return p ? p.name : 'Audience' }

// ================= UI =================
var myVote = 0;
function mmss(t) { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0') }
function renderHud() {
  var ph = machine.phase;
  $('gphase').textContent = ph === 'Lobby' ? 'INTERMISSION' : ph === 'Dressing' ? 'DRESSING ROOM' : ph === 'Runway' ? 'RUNWAY' : 'RESULTS';
  $('gtheme').textContent = theme && ph !== 'Lobby' ? 'Theme: ' + theme.name : 'Next theme loading…';
  $('gcoins').textContent = coins;
  $('gleft').hidden = $('gright').hidden = $('gready').hidden = ph !== 'Dressing';
  $('grate').hidden = ph !== 'Runway'; $('gresults').hidden = ph !== 'Podium';
}
function renderInventory() {
  $('gcats').innerHTML = Object.keys(CAT).map(function (k) { return '<button data-cat="' + k + '" aria-pressed="' + (k === cat) + '">' + k + '</button>' }).join('');
  var me = looks[ME];
  $('gitems').innerHTML = CAT[cat].map(function (it) {
    var on = (it.kind === 'lips' && me.lips === it.hex) || (me.outfit.id === it.id) || (me.layer && me.layer.id === it.id) || (me.hair.id === it.id) || (it.id === 'bag' && me.bag) || (it.id === 'star' && me.star);
    var col = it.kind === 'lips' ? it.hex : (function () { var st = stateFor(it.id); return CM.hex(st ? st.h : it.c[0], st ? st.s : it.c[1], st ? st.v : it.c[2]) })();
    var locked = it.price > 0 && !owned[it.id];
    return '<button class="item' + (on ? ' on' : '') + (locked ? ' locked' : '') + '" data-item="' + it.id + '"><span class="ic" style="--c:' + col + '">' + icon(it) + '</span><b>' + it.name + '</b><small>' + (locked ? '🪙 ' + it.price : it.ugc ? 'UGC · fixed colors' : it.recolor ? 'Recolorable' : it.kind === 'lips' ? 'Makeup' : '') + '</small></button>' }).join('') }
function icon(it) { var k = it.kind; return k === 'dress' ? '👗' : k === 'mini' ? '👚' : k === 'casual' ? '👕' : k === 'puffer' ? '🧥' : k === 'hair' ? '💇' : k === 'bag' ? '👜' : k === 'star' ? '⭐' : '💋' }
function stateFor(id) { var me = looks[ME]; if (me.outfit.id === id) return me.outfit; if (me.layer && me.layer.id === id) return me.layer; if (me.hair.id === id) return me.hair; if (id === 'bag') return me.bag; return null }
function equip(id) {
  var it = BYID[id], me = looks[ME];
  if (it.price > 0 && !owned[id]) { if (coins < it.price) { toast('Not enough coins'); return } coins -= it.price; owned[id] = 1; toast('Unlocked ' + it.name + ' · saved'); log('Bought ' + it.name + ' for ' + it.price + ' coins (DataStore save)') }
  if (it.kind === 'lips') me.lips = it.hex;
  else if (it.cat === 'Outfits') { me.outfit = me.outfit.id === id ? me.outfit : piece(id); selected = 'outfit' }
  else if (it.kind === 'puffer') { me.layer = me.layer ? null : piece(id); selected = me.layer ? 'layer' : 'outfit' }
  else if (it.kind === 'hair') { me.hair = me.hair.id === id ? me.hair : piece(id); selected = 'hair' }
  else if (it.kind === 'bag') { me.bag = me.bag ? null : piece(id); selected = me.bag ? 'bag' : 'outfit' }
  else if (it.kind === 'star') { me.star = !me.star; selected = 'star' }
  dressUp(avatars[ME], me); renderInventory(); renderPicker(); renderHud() }
function current() { var me = looks[ME]; if (selected === 'star') return { item: BYID.star, st: null }; var st = me[selected] || me.outfit; return { item: BYID[st.id], st: st } }
var wheel = $('gwheel'), wc = wheel.getContext('2d'), baseWheel = null;
(function () { var Wd = wheel.width, R = Wd / 2, img = wc.createImageData(Wd, Wd);
  for (var y = 0; y < Wd; y++) for (var x = 0; x < Wd; x++) { var dx = x - R, dy = y - R, i = (y * Wd + x) * 4; if (dx * dx + dy * dy > R * R) continue;
    var hs = CM.wheelToHs(dx, dy, R), c = CM.hsvToRgb(hs[0], hs[1], 1); img.data[i] = c[0] * 255; img.data[i + 1] = c[1] * 255; img.data[i + 2] = c[2] * 255; img.data[i + 3] = 255 }
  wc.putImageData(img, 0, 0); baseWheel = wc.getImageData(0, 0, Wd, Wd) })();
function renderPicker() {
  var cur = current(), it = cur.item, st = cur.st, lockedColor = !it.recolor;
  $('gsel').textContent = it.name; $('glock').hidden = !lockedColor; $('gbright').disabled = lockedColor;
  wc.putImageData(baseWheel, 0, 0);
  if (st && !lockedColor) { var R = wheel.width / 2, a = st.h * Math.PI / 180, x = R + Math.cos(a) * st.s * R, y = R - Math.sin(a) * st.s * R;
    wc.beginPath(); wc.arc(x, y, 8, 0, 7); wc.lineWidth = 3; wc.strokeStyle = '#fff'; wc.stroke(); wc.lineWidth = 1.5; wc.strokeStyle = '#2A1433'; wc.stroke();
    $('gbright').value = Math.round(st.v * 100); $('ghex').textContent = CM.hex(st.h, st.s, st.v); $('gsw').style.background = CM.hex(st.h, st.s, st.v) }
  else { $('ghex').textContent = 'fixed'; $('gsw').style.background = '#F5C542' }
  $('gpats').innerHTML = (it.pats && it.pats.length ? it.pats : []).map(function (p) { return '<button data-pat="' + p + '" aria-pressed="' + (st && st.p === p) + '"' + (lockedColor ? ' disabled' : '') + '>' + p + '</button>' }).join('') || '<span class="muted">No patterns for this item</span>' }
var dragging = false;
function pickColor(ev) { var cur = current(); if (!cur.item.recolor || !cur.st) return; var r = wheel.getBoundingClientRect(), sc = wheel.width / r.width;
  var hs = CM.wheelToHs((ev.clientX - r.left) * sc - wheel.width / 2, (ev.clientY - r.top) * sc - wheel.width / 2, wheel.width / 2);
  cur.st.h = hs[0]; cur.st.s = hs[1]; dressUp(avatars[ME], looks[ME]); renderPicker(); renderInventory() }
wheel.addEventListener('pointerdown', function (e) { dragging = true; wheel.setPointerCapture(e.pointerId); pickColor(e) });
wheel.addEventListener('pointermove', function (e) { if (dragging) pickColor(e) });
wheel.addEventListener('pointerup', function () { dragging = false });
$('gbright').addEventListener('input', function () { var cur = current(); if (cur.st && cur.item.recolor) { cur.st.v = this.value / 100; dressUp(avatars[ME], looks[ME]); renderPicker() } });
$('gpats').addEventListener('click', function (e) { var b = e.target.closest('[data-pat]'); var cur = current(); if (b && cur.st) { cur.st.p = b.dataset.pat; dressUp(avatars[ME], looks[ME]); renderPicker() } });
$('gcats').addEventListener('click', function (e) { var b = e.target.closest('[data-cat]'); if (b) { cat = b.dataset.cat; renderInventory() } });
$('gitems').addEventListener('click', function (e) { var b = e.target.closest('[data-item]'); if (b) equip(b.dataset.item) });
$('gready').addEventListener('click', function () { if (machine.phase === 'Dressing') { machine.timeLeft = Math.min(machine.timeLeft, 3); toast('Ready! Everyone else is ready too.') } });

function renderRate() {
  var on = machine.onStage(); var self = on === ME;
  $('grateLabel').innerHTML = on ? (self ? '<b>You’re on the runway!</b> Strike a pose.' : 'Rate <b>' + esc(nameOf(on)) + '</b>’s look') : '';
  $('gstars').innerHTML = [1, 2, 3, 4, 5].map(function (n) { return '<button data-star="' + n + '"' + (self ? ' disabled' : '') + ' class="' + (n <= myVote ? 'lit' : '') + '" aria-label="' + n + ' stars">★</button>' }).join('') }
$('gstars').addEventListener('click', function (e) { var b = e.target.closest('[data-star]'); if (!b || !tally) return; var on = machine.onStage(); var r = tally.cast(ME, on, +b.dataset.star);
  if (r[0]) { myVote = +b.dataset.star; renderRate(); log('You rated ' + nameOf(on) + ' ' + myVote + '★') } else toast('Vote rejected: ' + r[1]) });

function showResults(res, place, reward) {
  $('gresults').innerHTML = '<h3>Results · ' + esc(theme.name) + '</h3><ol>' + res.map(function (r, i) {
    return '<li class="' + (r.id === ME ? 'me' : '') + '"><span class="pl">' + (['🥇', '🥈', '🥉'][i] || (i + 1)) + '</span><span class="nm">' + esc(nameOf(r.id)) + '</span><span class="sc">' + r.score.toFixed(2) + '★</span></li>' }).join('') + '</ol>' +
    '<p>You placed <b>#' + place + '</b> · <span class="coinup">+' + reward + ' 🪙</span> saved</p><p class="muted">Fair score: top and bottom vote dropped once a look has 5+ votes.</p>' }

// start overlay
$('gstart').addEventListener('click', function () { if (started) return; started = true; $('gintro').hidden = true; PEOPLE.forEach(function (p) { machine.addPlayer(p.id) }); log('5 players joined the server'); renderHud() });

// camera drag to spin your avatar in the dressing room
var spinning = false, spinX = 0, mySpin = 0;
renderer.domElement.addEventListener('pointerdown', function (e) { spinning = true; spinX = e.clientX });
window.addEventListener('pointerup', function () { spinning = false });
window.addEventListener('pointermove', function (e) { if (spinning && machine.phase === 'Dressing') { mySpin += (e.clientX - spinX) * 0.012; spinX = e.clientX } });

// ================= loop =================
function resize() { var w = host.clientWidth, h = host.clientHeight; if (w === W && h === H) return; W = w; H = h; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix() }
var last = 0, visible = true, clock = 0;
function endWalk(av) { var u = av.userData; u.walk = null; u.armL.rotation.set(0, 0, 0); u.armR.rotation.set(0, 0, 0); u.legL.rotation.x = u.legR.rotation.x = 0; if (u.spot) { av.position.copy(u.spot.p); av.rotation.y = u.spot.r } }
function animateAvatar(av, dt, wdt) {
  var u = av.userData; u.phase += dt;
  if (u.walk) { var w = u.walk; w.t += wdt; var T = CFG.walkSeconds;
    if (w.t < 2.3) { av.position.z = -12 + (w.t / 2.3) * 15.5; av.rotation.y = 0; var sw = Math.sin(w.t * 9) * 0.55; u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.armL.rotation.x = -sw * 0.7; u.armR.rotation.x = sw * 0.7; u.armL.rotation.z = 0; u.armR.rotation.z = 0 }
    else if (w.t < 3.4) { u.legL.rotation.x = u.legR.rotation.x = 0; u.armL.rotation.x = 0; u.armR.rotation.x = 0; u.armR.rotation.z = 0.5; u.armL.rotation.z = -0.15; av.rotation.y = Math.sin((w.t - 2.3) * 3) * 0.45 }
    else if (w.t < T) { u.armR.rotation.z = 0; u.armL.rotation.z = 0; av.rotation.y = Math.PI; var k = (w.t - 3.4) / (T - 3.4); av.position.z = 3.5 - k * 9; var s2 = Math.sin(w.t * 9) * 0.55; u.legL.rotation.x = s2; u.legR.rotation.x = -s2; u.armL.rotation.x = -s2 * 0.7; u.armR.rotation.x = s2 * 0.7 }
    else { u.legL.rotation.x = u.legR.rotation.x = 0; u.armL.rotation.x = u.armR.rotation.x = 0 } // hold until the round calls the next model
  } else { var idle = Math.sin(u.phase * 2) * 0.05; u.armL.rotation.z = -0.08 - idle; u.armR.rotation.z = 0.08 + idle; u.armL.rotation.x = u.armR.rotation.x = 0; u.legL.rotation.x = u.legR.rotation.x = 0 } }
function frameCam(dt) {
  var ph = machine.phase, on = machine.onStage();
  if (!started || ph === 'Lobby') { camPosT.set(Math.sin(clock * 0.15) * 4, 7.5, 19); camLookT.set(0, 2.6, 0) }
  else if (ph === 'Dressing') { camPosT.set(0, 4.3, 15.5); camLookT.set(0, 2.9, 3) }
  else if (ph === 'Runway' && on) { var av = avatars[on], z = Math.max(-11, Math.min(3.5, av.position.z)); camPosT.set(1.2, 7.4, z + 14.5); camLookT.set(0, 2.7, z - 0.5) }
  else if (ph === 'Podium') { camPosT.set(0, 6, 9); camLookT.set(0, 3.6, -6) }
  // Narrow screens: pull the camera back so the whole avatar fits; on phones, lift the avatar above the inventory sheet.
  var f = Math.max(1, 1.35 / camera.aspect); if (f > 1) { camPosT.sub(camLookT).multiplyScalar(f).add(camLookT) }
  if (camera.aspect < 0.8 && ph === 'Dressing') camLookT.y -= 2.2;
  var k = 1 - Math.pow(0.02, dt); camPos.lerp(camPosT, k); camLook.lerp(camLookT, k); camera.position.copy(camPos); camera.lookAt(camLook) }
function loop(t) {
  requestAnimationFrame(loop); if (!visible) { last = t; return }
  resize(); var real = last ? (t - last) / 1000 : 0; var dt = Math.min(0.05, real); last = t; clock += dt;
  if (started) { handle(machine.update(Math.min(0.5, real)));
    pending = pending.filter(function (v) { v.at -= Math.min(0.5, real); if (v.at > 0) return true; if (tally && machine.onStage() === v.target) tally.cast(v.voter, v.target, v.stars); return false });
    $('gtime').textContent = mmss(machine.timeLeft) }
  if (machine.phase === 'Dressing') avatars[ME].rotation.y = mySpin + (spinning ? 0 : Math.sin(clock * 0.6) * 0.25);
  var wdt = Math.min(0.5, real); PEOPLE.forEach(function (p) { if (avatars[p.id].visible) animateAvatar(avatars[p.id], dt, wdt) });
  confetti = confetti.filter(function (m) { m.position.addScaledVector(m.userData.v, dt); m.rotation.x += dt * m.userData.r; m.rotation.y += dt * 3; if (m.position.y < -0.3) { scene.remove(m); m.material.dispose(); return false } return true });
  frameCam(dt); renderer.render(scene, camera) }
window.DTI_GAME.setVisible = function (v) { visible = v };
window.DTI_GAME.debug = function () { var on = machine.onStage(); return { phase: machine.phase, left: +machine.timeLeft.toFixed(2), on: on && nameOf(on), walkT: on && avatars[on].userData.walk ? +avatars[on].userData.walk.t.toFixed(2) : null, z: on ? +avatars[on].position.z.toFixed(1) : null } };
renderHud(); renderInventory(); renderPicker(); renderRate();
requestAnimationFrame(loop);
})();
