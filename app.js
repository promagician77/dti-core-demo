(function(){
'use strict';
var $=function(id){return document.getElementById(id)};
var esc=function(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var Tally=window.DUP.Tally;

// tabs (the 3D view pauses when hidden)
document.querySelector('.tabs').addEventListener('click',function(e){
  var b=e.target.closest('[role=tab]');if(!b)return;
  document.querySelectorAll('[role=tab]').forEach(function(t){t.setAttribute('aria-selected',String(t===b))});
  document.querySelectorAll('.panel').forEach(function(p){p.hidden=p.id!==b.dataset.tab});
  if(window.DTI_GAME&&window.DTI_GAME.setVisible)window.DTI_GAME.setVisible(b.dataset.tab==='play');
  if(b.dataset.tab==='vote')renderLog();
});

// Systems: last round from the game
window.DTI_GAME.onRound=function(results,themeName){
  var byRaw=results.slice().sort(function(a,b){return b.raw-a.raw});
  $('lastBody').innerHTML=results.map(function(r,i){var rr=byRaw.indexOf(r)+1;
    return '<tr'+(r.name==='You'?' style="background:#FCEFF4"':'')+'><td>#'+(i+1)+'</td><td>'+esc(r.name)+'</td><td>'+r.votes+'</td><td>'+r.raw.toFixed(2)+' <small class="note">#'+rr+'</small></td><td><b>'+r.score.toFixed(2)+'</b>'+(rr!==i+1?' <span class="chg">≠</span>':'')+'</td></tr>'}).join('');
  renderLog()};
function renderLog(){var ev=window.DTI_GAME.events;if(!ev.length)return;$('glog').innerHTML=ev.map(function(t){return '<li>'+esc(t)+'</li>'}).join('')}
setInterval(function(){if(!$('vote').hidden)renderLog()},1000);

// Systems: same votes, two ways to score them
var MODELS=[{id:1,n:'Model A',c:'#E11D74'},{id:2,n:'Model B',c:'#7C3AED'},{id:3,n:'Model C',c:'#0EA5E9'},{id:4,n:'Model D',c:'#F59E0B'},{id:5,n:'Model E',c:'#10B981'}];
var HONEST={1:{2:4,3:4,4:4,5:4,6:4},2:{1:4,3:3,4:4,5:3,6:4},3:{1:3,2:3,4:4,5:3,6:4},4:{1:2,2:3,3:2,5:2,6:3},5:{1:3,2:3,3:3,4:4,6:2}};
var tally;
function nm(id){return MODELS[id-1].n}
function flash(t,c){var f=$('vflash');f.textContent=t;f.className='flash '+c}
function resetVotes(){tally=new Tally([1,2,3,4,5]);Object.keys(HONEST).forEach(function(t){Object.keys(HONEST[t]).forEach(function(v){tally.cast(+v,+t,HONEST[t][v])})});$('vfriend').disabled=false;$('vtroll').disabled=false;flash('','');renderVotes()}
function renderVotes(){var res=tally.results();var byRaw=res.slice().sort(function(a,b){return b.raw-a.raw||b.votes-a.votes||a.id-b.id});
  $('vbody').innerHTML=MODELS.map(function(md){var r=res.filter(function(x){return x.id===md.id})[0];var rr=byRaw.indexOf(r)+1,fr=res.indexOf(r)+1;
    return '<tr><td><span class="dot" style="background:'+md.c+'"></span>'+md.n+'</td><td>'+r.votes+'</td><td>'+r.raw.toFixed(2)+' <small class="note">#'+rr+'</small></td><td><b>'+r.score.toFixed(2)+'</b> <small class="note">#'+fr+'</small>'+(rr!==fr?' <span class="chg">≠</span>':'')+'</td></tr>'}).join('');
  $('podRaw').innerHTML=byRaw.slice(0,3).map(function(r){return '<li>'+nm(r.id)+'</li>'}).join('');
  $('podFair').innerHTML=res.slice(0,3).map(function(r){return '<li>'+nm(r.id)+'</li>'}).join('')}
$('vfriend').addEventListener('click',function(){tally.cast(101,3,5);tally.cast(102,3,5);this.disabled=true;flash('Two friends gave Model C 5★. Watch the plain average podium.','ok');renderVotes()});
$('vtroll').addEventListener('click',function(){tally.cast(103,1,1);this.disabled=true;flash('A troll gave Model A 1★.','ok');renderVotes()});
$('vself').addEventListener('click',function(){var r=tally.cast(1,1,5);flash('Server rejected it: '+r[1],'bad')});
$('vreset').addEventListener('click',resetVotes);
resetVotes();

// Code tab
$('term').innerHTML=esc(window.TEST_OUTPUT||'').replace(/^(PASS.*)$/gm,'<span class="p">$1</span>').replace(/(12 passed, 0 failed|0 errors)/g,'<span class="p">$1</span>');
})();
