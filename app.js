(function(){
'use strict';
var $=function(id){return document.getElementById(id)};
var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};

// ---------- tabs ----------
document.querySelector('.tabs').addEventListener('click',function(e){
  var b=e.target.closest('[role=tab]');if(!b)return;
  document.querySelectorAll('[role=tab]').forEach(function(t){t.setAttribute('aria-selected',String(t===b))});
  document.querySelectorAll('.panel').forEach(function(p){p.hidden=p.id!==b.dataset.tab});
});

// ---------- ports of the Luau modules ----------
var ColorMath={
  hsvToRgb:function(h,s,v){h=((h%360)+360)%360;var c=v*s,x=c*(1-Math.abs((h/60)%2-1)),m=v-c,r,g,b;
    if(h<60){r=c;g=x;b=0}else if(h<120){r=x;g=c;b=0}else if(h<180){r=0;g=c;b=x}else if(h<240){r=0;g=x;b=c}else if(h<300){r=x;g=0;b=c}else{r=c;g=0;b=x}
    return[r+m,g+m,b+m]},
  wheelToHs:function(dx,dy,radius){var d=Math.sqrt(dx*dx+dy*dy);var h=((Math.atan2(-dy,dx)*180/Math.PI)%360+360)%360;return[h,Math.min(1,Math.max(0,d/radius))]},
  toHex:function(r,g,b){var c=function(x){return Math.min(255,Math.max(0,Math.round(x*255))).toString(16).toUpperCase().padStart(2,'0')};return'#'+c(r)+c(g)+c(b)}
};

function Machine(cfg){this.cfg=cfg;this.phase='Lobby';this.timeLeft=cfg.lobbySeconds;this.players={};this.contestants=[];this.stageIndex=0}
Machine.prototype.count=function(){return Object.keys(this.players).length};
Machine.prototype.addPlayer=function(id){this.players[id]=true};
Machine.prototype.removePlayer=function(id){
  delete this.players[id];var ev=[];var idx=this.contestants.indexOf(id);
  if(idx>=0){this.contestants.splice(idx,1);
    if(this.phase==='Runway'&&idx+1<=this.stageIndex)this.stageIndex--;
    if((this.phase==='Dressing'||this.phase==='Runway')&&this.contestants.length<this.cfg.minPlayers){ev.push({kind:'RoundAborted'});this.enter('Lobby',ev)}}
  return ev};
Machine.prototype.enter=function(p,ev){this.phase=p;
  if(p==='Lobby'){this.timeLeft=this.cfg.lobbySeconds;this.contestants=[];this.stageIndex=0}
  else if(p==='Dressing'){this.timeLeft=this.cfg.dressingSeconds;this.contestants=Object.keys(this.players).map(Number).sort(function(a,b){return a-b})}
  else if(p==='Runway'){this.stageIndex=1;this.timeLeft=this.cfg.walkSeconds}
  else if(p==='Podium'){this.timeLeft=this.cfg.podiumSeconds}
  ev.push({kind:'PhaseChanged',phase:p});if(p==='Runway')ev.push({kind:'OnStage',playerId:this.contestants[0]})};
Machine.prototype.update=function(dt){var ev=[];
  if(this.phase==='Lobby'&&this.count()<this.cfg.minPlayers){this.timeLeft=this.cfg.lobbySeconds;return ev}
  this.timeLeft-=dt;if(this.timeLeft>0)return ev;
  if(this.phase==='Lobby')this.enter('Dressing',ev);
  else if(this.phase==='Dressing')this.enter('Runway',ev);
  else if(this.phase==='Runway'){this.stageIndex++;if(this.stageIndex>this.contestants.length)this.enter('Podium',ev);else{this.timeLeft=this.cfg.walkSeconds;ev.push({kind:'OnStage',playerId:this.contestants[this.stageIndex-1]})}}
  else if(this.phase==='Podium')this.enter('Lobby',ev);
  return ev};
Machine.prototype.onStage=function(){return this.phase==='Runway'?this.contestants[this.stageIndex-1]:null};

function Tally(order){this.order=order.slice();this.votes={};var v=this.votes;order.forEach(function(id){v[id]={}})}
Tally.prototype.cast=function(voter,target,stars){
  if(voter===target)return[false,'self_vote'];var box=this.votes[target];if(!box)return[false,'not_a_contestant'];
  if(typeof stars!=='number'||stars!==Math.floor(stars)||stars<1||stars>5)return[false,'bad_stars'];
  box[voter]=stars;return[true,null]};
Tally.prototype.results=function(){var self=this,out=[],pos={};
  this.order.forEach(function(id,i){pos[id]=i;var list=Object.values(self.votes[id]);var n=list.length,sum=list.reduce(function(a,b){return a+b},0);
    var raw=n?sum/n:0,fair=raw;if(n>=5){list.sort(function(a,b){return a-b});fair=(sum-list[0]-list[n-1])/(n-2)}
    out.push({id:id,score:Math.round(fair*100)/100,raw:Math.round(raw*100)/100,votes:n})});
  out.sort(function(a,b){return b.score-a.score||b.votes-a.votes||pos[a.id]-pos[b.id]});return out};

// ---------- round tab ----------
var NAMES=['Ava','Mia','Zoe','Lia','Eve','Ivy','Noa','Kai'];
var COLORS=['#E11D74','#7C3AED','#0EA5E9','#F59E0B','#10B981','#EF4444','#14B8A6','#A855F7'];
var CFG={minPlayers:2,lobbySeconds:3,dressingSeconds:8,walkSeconds:2.5,podiumSeconds:4};
var m=new Machine(CFG),speed=1,nextId=1,running=false,last=0,roundVotes=null;

function figure(color,walking){return '<svg viewBox="0 0 56 96"><path d="M17 16q-2-14 11-14q13 0 11 14q1 9-3 13h-16q-4-4-3-13z" fill="#3B2A22"/><circle cx="28" cy="15" r="9" fill="#E8C3A8"/><path d="M19 12q9-10 18 0q-9-4-18 0z" fill="#3B2A22"/><path d="M20 28h16l3 18 10 40H7l10-40z" fill="'+color+'"/><rect x="21" y="84" width="5" height="10" fill="#E8C3A8"/><rect x="30" y="84" width="5" height="10" fill="#E8C3A8"/></svg>'}
function renderPhases(){$('phases').innerHTML=['Lobby','Dressing','Runway','Podium'].map(function(p){return '<div class="'+(m.phase===p?'on':'')+'">'+p+'</div>'}).join('')}
function renderStage(){
  var on=m.onStage();var ids=Object.keys(m.players).map(Number).sort(function(a,b){return a-b});
  $('stage').innerHTML=ids.length?ids.map(function(id){var spec=m.phase!=='Lobby'&&m.contestants.indexOf(id)<0;
    var tag=spec?'spectating':(on===id?'on runway':(m.phase==='Dressing'?'dressing':''));
    return '<div class="av'+(spec?' spec':'')+(on===id?' walk':'')+'">'+figure(COLORS[(id-1)%COLORS.length])+'<span>'+NAMES[(id-1)%NAMES.length]+'</span><span class="tag">'+tag+'</span></div>'}).join(''):'<span class="note">No players yet.</span>';
  $('ptime').textContent=m.phase==='Lobby'&&m.count()<CFG.minPlayers?'--':Math.max(0,m.timeLeft).toFixed(1)+'s';
  $('pname').textContent=m.phase==='Lobby'?(m.count()<CFG.minPlayers?'Waiting for 2+ players':'Next round starting'):m.phase==='Dressing'?'Dressing room (360s in game)':m.phase==='Runway'?'Model '+m.stageIndex+' of '+m.contestants.length+' walking':'Winners on the podium';
  renderPhases()}
function log(text,cls){var li=document.createElement('li');li.textContent=text;if(cls)li.className=cls;var ol=$('rlog');if(ol.firstChild&&ol.firstChild.classList&&ol.firstChild.classList.contains('muted'))ol.innerHTML='';ol.insertBefore(li,ol.firstChild)}
function nameOf(id){return NAMES[(id-1)%NAMES.length]}
function handle(evs){evs.forEach(function(e){
  if(e.kind==='PhaseChanged'){log('→ '+e.phase,'ph');
    if(e.phase==='Dressing')roundVotes=new Tally(m.contestants);
    if(e.phase==='Podium'&&roundVotes){var r=roundVotes.results().slice(0,3).map(function(x,i){return (i+1)+'. '+nameOf(x.id)+' ('+x.score+'★)'});log('Podium: '+r.join('  '))}}
  if(e.kind==='OnStage'){log(nameOf(e.playerId)+' walks the runway');
    if(roundVotes){Object.keys(m.players).map(Number).forEach(function(v){roundVotes.cast(v,e.playerId,2+((v*7+e.playerId*3)%4))})}}
  if(e.kind==='RoundAborted')log('Round aborted: not enough players','ab')})}
function tick(t){if(!running)return;var dt=last?Math.min(0.1,(t-last)/1000):0;last=t;handle(m.update(dt*speed));renderStage();requestAnimationFrame(tick)}
$('rstart').addEventListener('click',function(){if(running)return;for(var i=0;i<5;i++)m.addPlayer(nextId++);log('5 players joined');running=true;last=0;requestAnimationFrame(tick);this.disabled=true});
$('rjoin').addEventListener('click',function(){if(nextId>8){log('Demo server is full');return}var id=nextId++;m.addPlayer(id);log(nameOf(id)+' joined'+(m.phase!=='Lobby'?' (spectates until next round)':''));renderStage()});
$('rleave').addEventListener('click',function(){var pool=m.contestants.length?m.contestants:Object.keys(m.players).map(Number);if(!pool.length)return;
  var pick=m.phase==='Runway'&&m.stageIndex>1?m.contestants[0]:pool[pool.length-1];log(nameOf(pick)+' left'+(m.phase==='Runway'?' mid-runway':''),'ab');handle(m.removePlayer(pick));renderStage()});
document.querySelectorAll('[data-speed]').forEach(function(b){b.addEventListener('click',function(){speed=+b.dataset.speed;document.querySelectorAll('[data-speed]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))})})});
renderStage();

// ---------- color tab ----------
var ITEMS=[{id:'dress',name:'Slip Dress',sub:'Custom mesh · recolorable',recolor:true,pats:['Solid','Polka','Stripe','Floral']},
           {id:'jacket',name:'Puffer Jacket',sub:'Custom mesh · recolorable',recolor:true,pats:['Solid','Stripe']},
           {id:'bag',name:'Marketplace Bag',sub:'UGC · fixed colors',recolor:false,pats:[]}];
var look={dress:{h:330,s:.6,v:1,p:'Polka'},jacket:{h:200,s:.55,v:.85,p:'Solid'}},cur='dress';
var wheel=$('wheel'),wc=wheel.getContext('2d');
(function drawWheel(){var W=wheel.width,R=W/2,img=wc.createImageData(W,W);
  for(var y=0;y<W;y++)for(var x=0;x<W;x++){var dx=x-R,dy=y-R,d=Math.sqrt(dx*dx+dy*dy),i=(y*W+x)*4;if(d>R){img.data[i+3]=0;continue}
    var hs=ColorMath.wheelToHs(dx,dy,R),rgb=ColorMath.hsvToRgb(hs[0],hs[1],1);img.data[i]=rgb[0]*255;img.data[i+1]=rgb[1]*255;img.data[i+2]=rgb[2]*255;img.data[i+3]=255}
  wc.putImageData(img,0,0)})();
function wheelImg(){return wc.getImageData(0,0,wheel.width,wheel.width)}
var baseWheel=wheelImg();
function drawMarker(){wc.putImageData(baseWheel,0,0);var L=look[cur];if(!L)return;var R=wheel.width/2,a=L.h*Math.PI/180;
  var x=R+Math.cos(a)*L.s*R,y=R-Math.sin(a)*L.s*R;wc.beginPath();wc.arc(x,y,7,0,Math.PI*2);wc.lineWidth=3;wc.strokeStyle='#fff';wc.stroke();wc.lineWidth=1;wc.strokeStyle='#1E1420';wc.stroke()}
function applyLook(){
  ['dress','jacket'].forEach(function(id){var L=look[id],rgb=ColorMath.hsvToRgb(L.h,L.s,L.v),hex=ColorMath.toHex(rgb[0],rgb[1],rgb[2]);
    $(id+'Base').setAttribute('fill',hex);$(id+'Pat').setAttribute('fill',L.p==='Solid'?'none':'url(#p-'+L.p+')')});
  $('dress').hidden=cur==='jacket';$('jacket').hidden=cur!=='jacket';
  var item=ITEMS.filter(function(i){return i.id===cur})[0];var L=look[cur]||look.dress;var rgb=ColorMath.hsvToRgb(L.h,L.s,L.v),hex=ColorMath.toHex(rgb[0],rgb[1],rgb[2]);
  $('lockover').hidden=item.recolor;$('bright').disabled=!item.recolor;
  if(item.recolor){$('hex').textContent=hex;$('sw').style.background=hex;$('bright').value=Math.round(L.v*100);$('lyBase').setAttribute('fill',hex);$('lyOut').setAttribute('fill',hex)}
  else{$('hex').textContent='locked';$('sw').style.background='#8B5E3C'}
  $('pats').innerHTML=(item.pats.length?item.pats:['Solid']).map(function(p){return '<button data-pat="'+p+'" aria-pressed="'+(item.recolor&&L.p===p)+'"'+(item.recolor?'':' disabled')+'>'+p+'</button>'}).join('');
  $('modelcap').textContent=item.recolor?item.name+': '+hex+(L.p!=='Solid'?' with '+L.p.toLowerCase()+' pattern':''):'The marketplace bag keeps its own colors. The wheel is locked for it.';
  $('items').innerHTML=ITEMS.map(function(i){return '<button data-item="'+i.id+'" aria-pressed="'+(i.id===cur)+'">'+i.name+'<small>'+i.sub+'</small></button>'}).join('');
  drawMarker()}
function pick(ev){var item=ITEMS.filter(function(i){return i.id===cur})[0];if(!item.recolor)return;var r=wheel.getBoundingClientRect(),sc=wheel.width/r.width;
  var dx=(ev.clientX-r.left)*sc-wheel.width/2,dy=(ev.clientY-r.top)*sc-wheel.width/2,hs=ColorMath.wheelToHs(dx,dy,wheel.width/2);look[cur].h=hs[0];look[cur].s=hs[1];applyLook()}
var drag=false;wheel.addEventListener('pointerdown',function(e){drag=true;wheel.setPointerCapture(e.pointerId);pick(e)});
wheel.addEventListener('pointermove',function(e){if(drag)pick(e)});wheel.addEventListener('pointerup',function(){drag=false});
$('bright').addEventListener('input',function(){if(look[cur]){look[cur].v=this.value/100;applyLook()}});
$('items').addEventListener('click',function(e){var b=e.target.closest('[data-item]');if(b){cur=b.dataset.item;applyLook()}});
$('pats').addEventListener('click',function(e){var b=e.target.closest('[data-pat]');if(b&&look[cur]){look[cur].p=b.dataset.pat;applyLook()}});
applyLook();

// ---------- voting tab ----------
var MODELS=[{id:1,n:'Model A',c:'#E11D74'},{id:2,n:'Model B',c:'#7C3AED'},{id:3,n:'Model C',c:'#0EA5E9'},{id:4,n:'Model D',c:'#F59E0B'},{id:5,n:'Model E',c:'#10B981'}];
var HONEST={1:{2:4,3:4,4:4,5:4,6:4},2:{1:4,3:3,4:4,5:3,6:4},3:{1:3,2:3,4:4,5:3,6:4},4:{1:2,2:3,3:2,5:2,6:3},5:{1:3,2:3,3:3,4:4,6:2}};
var tally,friend=false,troll=false;
function nm(id){return MODELS[id-1].n}
function resetVotes(){tally=new Tally([1,2,3,4,5]);Object.keys(HONEST).forEach(function(t){Object.keys(HONEST[t]).forEach(function(v){tally.cast(+v,+t,HONEST[t][v])})});friend=false;troll=false;$('vfriend').disabled=false;$('vtroll').disabled=false;flash('','');renderVotes()}
function flash(t,c){var f=$('vflash');f.textContent=t;f.className='flash '+c}
function renderVotes(){var res=tally.results();var byRaw=res.slice().sort(function(a,b){return b.raw-a.raw||b.votes-a.votes||a.id-b.id});
  var rows=MODELS.map(function(md){var r=res.filter(function(x){return x.id===md.id})[0];var rawRank=byRaw.indexOf(r)+1,fairRank=res.indexOf(r)+1;
    return '<tr><td><span class="dot" style="background:'+md.c+'"></span>'+md.n+'</td><td>'+r.votes+'</td><td>'+r.raw.toFixed(2)+' <small class="note">#'+rawRank+'</small></td><td><b>'+r.score.toFixed(2)+'</b> <small class="note">#'+fairRank+'</small>'+(rawRank!==fairRank?' <span class="chg">≠</span>':'')+'</td></tr>'});
  $('vbody').innerHTML=rows.join('');
  $('podRaw').innerHTML=byRaw.slice(0,3).map(function(r){return '<li>'+nm(r.id)+'</li>'}).join('');
  $('podFair').innerHTML=res.slice(0,3).map(function(r){return '<li>'+nm(r.id)+'</li>'}).join('')}
$('vfriend').addEventListener('click',function(){tally.cast(101,3,5);tally.cast(102,3,5);friend=true;this.disabled=true;flash('Two friends gave Model C 5★. Watch the plain average podium.','ok');renderVotes()});
$('vtroll').addEventListener('click',function(){tally.cast(103,1,1);troll=true;this.disabled=true;flash('A troll gave Model A 1★.','ok');renderVotes()});
$('vself').addEventListener('click',function(){var r=tally.cast(1,1,5);flash('Server rejected it: '+r[1],'bad')});
$('vreset').addEventListener('click',resetVotes);
resetVotes();

// ---------- code tab ----------
$('term').innerHTML=esc(window.TEST_OUTPUT||'').replace(/^(PASS.*)$/gm,'<span class="p">$1</span>').replace(/(12 passed, 0 failed|0 errors)/g,'<span class="p">$1</span>');
})();
