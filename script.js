/* ═══════════════════════════════════════════════════════════════════
   THIS WEB DOES NOT COMPLY — script.js v8
   UI boxes outside rect (below). No gradient. Extreme scroll Z-depth.
   Aggressive selection. 3D door-fold exit. Nav pink buttons.
   Smaller YOU FAILED. Game clip fix.
═══════════════════════════════════════════════════════════════════ */
'use strict';

const FM = sz => `500 ${sz}px 'Monument','Helvetica Neue',Arial,sans-serif`;
const FS  = 13;
const FSL = 16;

const STAGE_LIME=[
  '#d8ff88',  /* 0 game       — soft lime-gray, but already clearly lime */
  '#d2ff60',  /* 1 scroll     — slightly stronger */
  '#ccff30',  /* 2 selection  — clearer lime presence */
  '#c8ff10',  /* 3 readability — saturated lime */
  '#c4ff00',  /* 4 navigation  — strong lime, close to final */
  '#ccff00',  /* 5 exit        — vivid = top bar, unchanged */
];

const PINK   = '#f5d8e0';
const BG     = '#e8e8e6';
const RECT   = '#ececea';
const BK     = '#111111';

/* Rect geometry — identical every stage */
const RX_F = 0.05;
const RY_F = 0.04;
const RW_F = 0.90;
const RH_F = 0.84;

const $     = id => document.getElementById(id);
const rnd   = (a,b) => a + Math.random()*(b-a);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
const ease  = t => t<.5?2*t*t:-1+(4-2*t)*t;
const lerp  = (a,b,t) => a+(b-a)*t;

let T=0, FC=0;
let MX=-1, MY=-1, magX=-100, magY=-100;

let allSections=[], currentIdx=0, isSnapping=false;
const SNAP_MS=580;

let activeStage=-1, stageEnteredAt=0;
const LOCK_SEC=15;
let lockVisible=false, failedCooldown=0;
let minReachableStage=0;

const DATA={
  game:{tiles:[],cols:0,rows:0,cellSz:0,cmdIdx:0,lastSwitch:0,switchCooldown:900,boardX:0,boardY:0,inited:false},
  scroll:{offset:0,vel:0,inited:false},
  sel:{nodes:[],edges:[],clicks:0,nextId:0,inited:false},
  read:{words:[],eruptions:[],interval:null,inited:false},
  nav:{x:0,y:0,vx:0,vy:0,trails:[],inited:false},
  exit:{tries:0,inited:false,efold:0,sfold:0}
};

/* ═══════════════════════════════════════════════════════════════
   LOADER — pure lime full screen, holds 2.5s, zooms inward + fades
═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded',()=>{
  const ldr=$('loader');

  /* After 2.5s: scale lime up slightly (zoom INTO the surface feel), fade out */
  setTimeout(()=>{
    const lm=$('ld-lime');
    if(lm){
      lm.style.transition='transform 0.55s cubic-bezier(.4,0,.6,1), opacity 0.45s ease';
      lm.style.transform='scale(1.14)';
      lm.style.opacity='0';
    }
    ldr.style.transition='opacity 0.45s ease 0.1s';
    ldr.style.opacity='0';
    setTimeout(()=>{ldr.style.display='none';startWebsite();},560);
  },2500);
});

function startWebsite(){
  $('bar')?.classList.remove('hide');$('sc')?.classList.remove('hide');
  buildStages();buildSectionIndex();
  wireBar();wireMouse();wireSnap();wireScrollFeed();
  requestAnimationFrame(()=>{
    const idx=allSections.findIndex(s=>s.id==='s-game');
    if(idx>=0){snapToIndex(idx,false);minReachableStage=idx;}
  });
  requestAnimationFrame(loop);
}

/* ═══════════════════════════════════════════════════════════════
   BUILD STAGES
═══════════════════════════════════════════════════════════════ */
const SDEFS=[
  {id:'scrolling',num:1},{id:'selection',num:2},{id:'readability',num:3},
  {id:'navigation',num:4},{id:'exit',num:5}
];

function buildStages(){
  const dyn=$('dyn');
  [...SDEFS].reverse().forEach(s=>{
    const sec=document.createElement('section');
    sec.className='s-stage';sec.id='s-'+s.id;sec.dataset.i=s.num;
    sec.innerHTML=`<canvas class="stage-cv" id="cv-${s.id}"></canvas>`;
    dyn.appendChild(sec);
  });
  const es=$('s-exit');
  if(es){
    const eb=document.createElement('div');
    eb.className='exit-buttons';eb.id='exit-btns';
    eb.innerHTML=`<button class="exit-btn" id="btn-exit">EXIT</button>
                  <button class="exit-btn stay" id="btn-stay">STAY</button>`;
    es.appendChild(eb);
  }
}

function buildSectionIndex(){allSections=Array.from($('tall').querySelectorAll('section'));}

/* ═══════════════════════════════════════════════════════════════
   SNAP
═══════════════════════════════════════════════════════════════ */
function wireSnap(){
  const scEl=$('sc');
  function nearest(){
    const mid=scEl.scrollTop+scEl.clientHeight/2;let b=0,bd=Infinity;
    allSections.forEach((s,i)=>{const d=Math.abs((s.offsetTop+s.offsetHeight/2)-mid);if(d<bd){bd=d;b=i;}});
    return b;
  }
  scEl.addEventListener('wheel',e=>{
    e.preventDefault();
    const dir=e.deltaY>0?1:-1;
    if(dir<0&&!canLeaveUp()) return;
    if(dir>0&&clamp(nearest()+1,0,allSections.length-1)>minReachableStage) return;
    if(!isSnapping) snapToIndex(clamp(nearest()+dir,0,allSections.length-1),true);
  },{passive:false});
  let ty0=0;
  scEl.addEventListener('touchstart',e=>{ty0=e.touches[0].clientY;},{passive:true});
  scEl.addEventListener('touchend',e=>{
    if(isSnapping) return;
    const dy=ty0-e.changedTouches[0].clientY;if(Math.abs(dy)<30) return;
    const dir=dy>0?1:-1;
    if(dir<0&&!canLeaveUp()) return;
    if(dir>0&&clamp(nearest()+1,0,allSections.length-1)>minReachableStage) return;
    snapToIndex(clamp(nearest()+dir,0,allSections.length-1),true);
  },{passive:true});
  document.addEventListener('keydown',e=>{
    if(!['ArrowUp','ArrowDown','PageUp','PageDown',' '].includes(e.key)) return;
    e.preventDefault();if(isSnapping) return;
    const dir=['ArrowDown','PageDown',' '].includes(e.key)?1:-1;
    if(dir<0&&!canLeaveUp()) return;
    if(dir>0&&clamp(nearest()+1,0,allSections.length-1)>minReachableStage) return;
    snapToIndex(clamp(nearest()+dir,0,allSections.length-1),true);
  });
}

function canLeaveUp(){
  if(activeStage<0) return true;
  if((performance.now()-stageEnteredAt)/1000>=LOCK_SEC) return true;
  showFailed();return false;
}

function showFailed(){
  const now=performance.now();if(now-failedCooldown<700) return;
  failedCooldown=now;
  const el=$('failed-msg');if(!el) return;
  el.classList.remove('hide');el.style.animation='none';void el.offsetWidth;el.style.animation='';
  setTimeout(()=>el.classList.add('hide'),560);
}

function snapToIndex(idx,animate){
  if(idx<0||idx>=allSections.length) return;
  const scEl=$('sc');const target=allSections[idx].offsetTop;currentIdx=idx;
  if(!animate){scEl.scrollTop=target;onEnter(allSections[idx]);return;}
  isSnapping=true;
  const start=scEl.scrollTop,delta=target-start,t0=performance.now();
  (function tick(now){
    const p=Math.min(1,(now-t0)/SNAP_MS);scEl.scrollTop=start+delta*ease(p);
    if(p<1){requestAnimationFrame(tick);}
    else{scEl.scrollTop=target;isSnapping=false;onEnter(allSections[idx]);}
  })(performance.now());
}

function onEnter(sec){
  const id=sec.id;
  if(id==='s-bottom'){activeStage=-1;updateBar(-1);hideLock();return;}
  if(id==='s-game'){
    activeStage=0;stageEnteredAt=performance.now();
    updateBar(0);showLock();wireGame();return;
  }
  const s=SDEFS.find(s=>'s-'+s.id===id);if(!s) return;
  activeStage=s.num;stageEnteredAt=performance.now();
  updateBar(s.num);showLock();initStage(s.id);
  const idx=allSections.findIndex(ss=>ss.id===id);
  if(idx>=0&&idx<minReachableStage) minReachableStage=idx;
}

function updateBar(num){
  document.body.dataset.stage=String(Math.max(0,num));
  document.querySelectorAll('.cw').forEach(w=>w.classList.toggle('active',parseInt(w.dataset.stage,10)===num));
}

/* tickLock: DOM lock-ind is hidden; canvas drawUI handles all lock display */
function tickLock(){}
function showLock(){lockVisible=true;}
function hideLock(){lockVisible=false;}

function wireBar(){
  document.querySelectorAll('.cw').forEach(w=>{
    w.addEventListener('click',()=>{
      const num=parseInt(w.dataset.stage,10);
      const def=SDEFS.find(s=>s.num===num);if(!def) return;
      const idx=allSections.findIndex(s=>s.id==='s-'+def.id);
      if(idx>=0&&idx>=minReachableStage) snapToIndex(idx,true);
    });
  });
}
function wireMouse(){document.addEventListener('mousemove',e=>{MX=e.clientX;MY=e.clientY;});}
function wireScrollFeed(){window.addEventListener('wheel',e=>{if(activeStage===1) feedScroll(e.deltaY);},{passive:true});}

/* ═══════════════════════════════════════════════════════════════
   CANVAS UTILITY
═══════════════════════════════════════════════════════════════ */
function sz(cv){
  const dpr=devicePixelRatio||1;
  const W=cv.parentElement.offsetWidth,H=cv.parentElement.offsetHeight;
  if(!W||!H) return null;
  const nW=W*dpr,nH=H*dpr;
  if(cv.width!==nW||cv.height!==nH){cv.width=nW;cv.height=nH;cv.style.width=W+'px';cv.style.height=H+'px';}
  const ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
  return {ctx,W,H};
}

function xhair(ctx,cv){
  if(MX<0) return;
  const r=cv.getBoundingClientRect();
  const rx=MX-r.left,ry=MY-r.top;
  if(rx<0||rx>r.width||ry<0||ry>r.height) return;
  ctx.save();ctx.strokeStyle='rgba(0,0,0,.13)';ctx.lineWidth=.7;
  [[rx-7,ry,rx-2,ry],[rx+2,ry,rx+7,ry],[rx,ry-7,rx,ry-2],[rx,ry+2,rx,ry+7]]
    .forEach(([x1,y1,x2,y2])=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();});
  ctx.restore();
}

/* ═══════════════════════════════════════════════════════════════
   SHARED BACKGROUND — flat gray + subtle texture + one lime rect
   NO gradient, NO glow, NO opacity layers.
═══════════════════════════════════════════════════════════════ */
function drawBg(ctx,W,H,sNum){
  const lime=STAGE_LIME[sNum]||STAGE_LIME[0];

  /* 1. Clean flat gray */
  ctx.fillStyle=BG;ctx.fillRect(0,0,W,H);

  /* 2. Faint typography texture */
  ctx.save();
  ctx.font=FM(8);ctx.fillStyle='rgba(17,17,17,0.028)';ctx.textBaseline='top';
  const word=['SCROLLING','SELECTION','READABILITY','NAVIGATION','EXIT','EXIT'][sNum]||'GAME';
  const tw=ctx.measureText(word+'   ').width;
  for(let y=0;y<H;y+=18){
    const ox=Math.floor(y/18)%2===0?0:tw/2;
    for(let x=-tw;x<W+tw;x+=tw) ctx.fillText(word+'   ',x+ox,y);
  }
  ctx.restore();

  /* 3. ONE lime rectangle */
  ctx.fillStyle=lime;
  ctx.fillRect(W*RX_F,H*RY_F,W*RW_F,H*RH_F);
}

/* ═══════════════════════════════════════════════════════════════
   GLOBAL UI — cmd box (centered) + lock box (right-aligned)
   BOTH sit BELOW the lime rectangle on the SAME baseline.
   SINGLE source of truth — called once per render, produces ONE lock box.
═══════════════════════════════════════════════════════════════ */
const UI_BH = FS + 14;           /* shared box height */
const UI_PX = 11;                 /* shared horizontal padding */
const UI_PY = (UI_BH - FS) / 2;  /* vertical centering of text */
const UI_Y_OFF = 6;               /* gap between rect bottom and boxes */

function drawUI(ctx,W,H,cmdText){
  const rectRight  = W*(RX_F+RW_F);
  const rectBottom = H*(RY_F+RH_F);
  const by = rectBottom + UI_Y_OFF;   /* BELOW the lime rect */

  /* Single font declaration — both boxes use exactly the same FM(FS) */
  ctx.font=FM(FS);
  ctx.textBaseline='top';

  /* ── Lock box — sentence case, right-aligned to rect right edge ── */
  const elapsed=(performance.now()-stageEnteredAt)/1000;
  const rem=Math.max(0,LOCK_SEC-elapsed);
  const lockTxt=rem>0?'Locked — '+Math.ceil(rem)+'s':'Unlocked';
  const ltw=ctx.measureText(lockTxt).width;
  const lbw=ltw+UI_PX*2;
  const lbx=rectRight-lbw;
  ctx.fillStyle=RECT;ctx.fillRect(lbx,by,lbw,UI_BH);
  ctx.fillStyle=BK;ctx.fillText(lockTxt,lbx+UI_PX,by+UI_PY);

  /* ── Command box — centered, same font, same height ── */
  const ctw=ctx.measureText(cmdText).width;
  const cbw=ctw+UI_PX*2;
  const cbx=W/2-cbw/2;
  ctx.fillStyle=RECT;ctx.fillRect(cbx,by,cbw,UI_BH);
  ctx.fillStyle=BK;ctx.fillText(cmdText,cbx+UI_PX,by+UI_PY);
}
/* Alias */
function cmdBox(ctx,W,H,text){drawUI(ctx,W,H,text);}

function initStage(id){
  if(id==='scrolling')   initScrolling();
  if(id==='selection')   initSelection();
  if(id==='readability') initReadability();
  if(id==='navigation')  initNavigation();
  if(id==='exit')        initExit();
}

/* ═══════════════════════════════════════════════════════════════
   GAME — tight grid, clip to rect, only reacts on proximity
═══════════════════════════════════════════════════════════════ */
const G_LIME='#e8ffa0';
const G_PINK=PINK;
const G_GRAY='#d8d8d6';

const GAME_CMDS=[
  {color:G_PINK,label:'PRESS THE PINK BUTTON'},
  {color:G_GRAY,label:'PRESS THE GREY BUTTON'},
  {color:G_LIME,label:'PRESS THE LIME BUTTON'},
];

function wireGame(){
  const cv=$('cv-game');if(!cv||cv.dataset.wired) return;
  cv.dataset.wired='1';
  if(!DATA.game.inited){DATA.game.inited=true;buildGrid(cv);}
  cv.addEventListener('click',e=>{const r=cv.getBoundingClientRect();gameClick(e.clientX-r.left,e.clientY-r.top);});
}

function buildGrid(cv){
  const W=cv.parentElement.offsetWidth||window.innerWidth;
  const H=cv.parentElement.offsetHeight||window.innerHeight;
  const SZ=14;  /* smaller tiles = denser fill */
  const boardX=Math.round(W*RX_F);
  const boardY=Math.round(H*RY_F);
  const boardW=Math.round(W*RW_F);
  const boardH=Math.round(H*RH_F);
  /* +2 rows/cols to guarantee full coverage — clip handles overflow */
  const cols=Math.floor(boardW/SZ)+2;
  const rows=Math.floor(boardH/SZ)+2;
  DATA.game.cols=cols;DATA.game.rows=rows;DATA.game.cellSz=SZ;
  DATA.game.boardX=boardX;DATA.game.boardY=boardY;
  DATA.game.boardW=boardW;DATA.game.boardH=boardH;
  DATA.game.tiles=[];
  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const pat=(r*3+c)%5;
      const color=pat<2?G_PINK:pat<4?G_GRAY:G_LIME;
      DATA.game.tiles.push({col:c,row:r,rx:c,color});
    }
  }
  DATA.game.cmdIdx=0;DATA.game.lastSwitch=performance.now();
}

function slideTargetTiles(){
  const tc=GAME_CMDS[DATA.game.cmdIdx%GAME_CMDS.length].color;
  DATA.game.tiles.forEach(t=>{if(t.color===tc) t.col=(t.col+1)%DATA.game.cols;});
}

function gameClick(cx,cy){
  const SZ=DATA.game.cellSz,bX=DATA.game.boardX,bY=DATA.game.boardY;
  for(let i=0;i<DATA.game.tiles.length;i++){
    const t=DATA.game.tiles[i];
    const tx=bX+t.rx*SZ,ty=bY+t.row*SZ;
    if(cx>=tx&&cx<=tx+SZ&&cy>=ty&&cy<=ty+SZ){
      const nb=DATA.game.tiles.filter(n=>Math.abs(n.col-t.col)<=1&&Math.abs(n.row-t.row)<=1&&n!==t);
      if(nb.length){const nn=nb[Math.floor(Math.random()*nb.length)];const tmp=t.color;t.color=nn.color;nn.color=tmp;}
      break;
    }
  }
}

function renderGame(cv){
  const r=sz(cv);if(!r) return;
  const {ctx,W,H}=r;ctx.clearRect(0,0,W,H);
  drawBg(ctx,W,H,0);

  const SZ=DATA.game.cellSz,now=performance.now();
  const bX=DATA.game.boardX,bY=DATA.game.boardY;

  /* Lerp — only animate when tile has moved */
  DATA.game.tiles.forEach(t=>{
    if(Math.abs(t.rx-t.col)>0.01) t.rx=lerp(t.rx,t.col,0.14);
    else t.rx=t.col;
  });

  /* Clip board to lime rect to prevent any overflow */
  ctx.save();
  ctx.beginPath();
  ctx.rect(bX,bY,DATA.game.boardW,DATA.game.boardH);
  ctx.clip();

  /* Draw tiles — no gaps */
  DATA.game.tiles.forEach(t=>{
    ctx.fillStyle=t.color;
    ctx.fillRect(Math.round(bX+t.rx*SZ),Math.round(bY+t.row*SZ),SZ,SZ);
  });
  ctx.restore();

  /* Proximity — board only reacts when cursor is near current target */
  const cvR=cv.getBoundingClientRect();
  const cx=MX-cvR.left,cy=MY-cvR.top;
  if(cx>0&&cy>0&&(now-DATA.game.lastSwitch)>DATA.game.switchCooldown){
    const tc=GAME_CMDS[DATA.game.cmdIdx%GAME_CMDS.length].color;
    let near=false;
    for(let i=0;i<DATA.game.tiles.length;i++){
      const t=DATA.game.tiles[i];if(t.color!==tc) continue;
      if(Math.hypot(bX+t.rx*SZ+SZ/2-cx,bY+t.row*SZ+SZ/2-cy)<58){near=true;break;}
    }
    if(near){
      slideTargetTiles();
      DATA.game.cmdIdx=(DATA.game.cmdIdx+1)%GAME_CMDS.length;
      DATA.game.lastSwitch=now;
    }
  }

  cmdBox(ctx,W,H,GAME_CMDS[DATA.game.cmdIdx%GAME_CMDS.length].label);
  xhair(ctx,cv);
}

/* ═══════════════════════════════════════════════════════════════
   SCROLLING — violent spatial distortion, 100% opacity, clipped
   Lines live on different Z-planes. Scrolling reveals depth.
   Some letters become screen-filling. No opacity ever used.
═══════════════════════════════════════════════════════════════ */
const SCROLL_BASE=
`scroll.input.recorded()
viewport.position += deltaY — result: null
content.render(next_fragment) — returned: void
overflow.return(current_position) — default behavior
scroll.expected(progress) — scroll.actual(repetition)
position.unchanged() — advancement: null
scroll.offset(update) — viewport.reposition(active_content)
scroll.locked === true — user.request(content.advance): rejected
The system has received a scroll input. This input has been recorded and
forwarded to the rendering queue. Scroll input does not constitute a
request for content advancement. The interface reserves the right to
reposition all rendered content without prior notice. position.delta===0.
By continuing to scroll the user acknowledges that scrolling within this
system does not constitute progress. scroll.guarantee(null).
viewport.position += deltaY has been evaluated. The result is: null.
overflow.return(current_position) is the default behavior of this interface.
Perceived movement does not indicate a change of state. scroll.locked===true.
content.render(next_fragment) has returned void. scroll.guarantee(null).
position.delta===0. By continuing to scroll, the user acknowledges that
scrolling in this system does not equal progress.
scroll.input.recorded() — advancement: null — position.unchanged()
viewport.position += deltaY — result: null — scroll.guarantee(null)
content.render(next_fragment) — returned: void — overflow: current_position
scroll.locked === true — user.request(advance): rejected — delta===0
scroll.expected(progress) — scroll.actual(repetition) — loop: infinite
The system has received a scroll input. This input has been forwarded.
scroll.guarantee(null). position.delta===0. viewport.reposition: none.
By continuing to scroll the user acknowledges the system refuses progress.
scroll.input.recorded() — scroll.locked === true — advancement: null
viewport.position += deltaY — result: null — content.render: void
overflow.return(current_position) — perceived movement: not state change
scroll.expected(progress) — scroll.actual(repetition) — loop continues
position.unchanged() — advancement: null — scroll.guarantee(null)
scroll.offset(update) — viewport.reposition(active_content): rejected
scroll.locked === true — user.request(content.advance): rejected
The interface reserves the right to reposition content without notice.
scroll.guarantee(null). position.delta===0. content.advance: void.
viewport.position += deltaY has been evaluated. result: null.
overflow.return(current_position) is the default behavior always.
Perceived movement in this interface does not indicate a change in state.
content.render(next_fragment) returns void. scroll.guarantee(null).
position.delta===0. Scrolling in this system does not constitute progress.
scroll.input.recorded() — scroll.locked === true — loop: infinite
viewport.position += deltaY — result: null — content.render: void
scroll.input.recorded() — advancement: null — position.unchanged()
viewport.position += deltaY — result: null — scroll.guarantee(null)
content.render(next_fragment) — returned: void — overflow: current_position
scroll.locked === true — advancement: null — position.delta===0
scroll.expected(progress) — scroll.actual(repetition) — loop: infinite
The system has received a scroll input. This input has been forwarded.
scroll.guarantee(null). position.delta===0. viewport.reposition: none.
By continuing to scroll the user acknowledges the system refuses progress.
scroll.input.recorded() — scroll.locked === true — advancement: null
viewport.position += deltaY — result: null — content.render: void
overflow.return(current_position) — perceived movement: not state change
scroll.expected(progress) — scroll.actual(repetition) — loop continues
position.unchanged() — advancement: null — scroll.guarantee(null)
scroll.offset(update) — viewport.reposition(active_content): rejected
scroll.locked === true — user.request(content.advance): rejected
The interface reserves the right to reposition content without notice.
scroll.guarantee(null). position.delta===0. content.advance: void.
viewport.position += deltaY — result: null — content.render: void
scroll.input.recorded() — loop: infinite — advancement: null
scroll.locked === true — user.request(advance): rejected — delta===0
Perceived movement does not indicate a change of state. scroll.locked===true.
content.render(next_fragment) returns void. scroll.guarantee(null).
position.delta===0. Scrolling in this system does not constitute progress.
scroll.input.recorded() — scroll.locked === true — loop: infinite
viewport.position += deltaY — result: null — content.render: void`;

const SCROLL_LINES=SCROLL_BASE.split('\n');
const HALF_S=Math.ceil(SCROLL_LINES.length/2);
const COL1=SCROLL_LINES.slice(0,HALF_S);
const COL2=SCROLL_LINES.slice(HALF_S);

function initScrolling(){DATA.scroll.offset=0;DATA.scroll.vel=0;DATA.scroll.inited=true;}
function feedScroll(dy){DATA.scroll.vel+=dy*1.1;}  /* boosted velocity */

function renderScrolling(cv){
  const r=sz(cv);if(!r) return;
  const {ctx,W,H}=r;ctx.clearRect(0,0,W,H);
  drawBg(ctx,W,H,1);

  DATA.scroll.vel*=0.82;
  DATA.scroll.offset+=DATA.scroll.vel;
  DATA.scroll.offset=clamp(DATA.scroll.offset,-H*1.6,H*1.6);
  DATA.scroll.offset*=0.97;

  const pull=DATA.scroll.offset;
  const absP=Math.abs(pull);

  const px=W*RX_F,py=H*RY_F,pw=W*RW_F,ph=H*RH_F;
  const colW=(pw-32)/2;
  const lineH=Math.round(FS*1.55);
  const textStartY=py+14;

  /* Hard clip — nothing escapes the lime rect */
  ctx.save();ctx.beginPath();ctx.rect(px,py,pw,ph);ctx.clip();

  ctx.font=FM(FS);ctx.fillStyle=BK;ctx.textBaseline='top';

  /* Per-line violent Z-depth spatial displacement.
     dp ∈ [-1,+1] per line: +1 = explodes toward viewer, -1 = collapses deep.
     At rest: normal flat paragraph.
     While scrolling: some lines grow to fill entire screen,
     others shrink to near-invisible specks, X parallax is extreme.
     NO opacity — pure position + scale + skew. */
  const drawSpatialCol=(lines,baseX)=>{
    lines.forEach((line,i)=>{
      const dp=Math.sin(i*0.53+0.8)*Math.cos(i*0.29);

      /* SCALE: violent. dp=+1 at full pull fills ~4× the screen height */
      const maxSc = absP > 10 ? 1 + (absP/H)*18*Math.max(0,dp) : 1;
      const minSc = Math.max(0.02, 1 - absP*0.014*Math.max(0,-dp));
      const sc = dp >= 0 ? maxSc : minSc;

      /* X: extreme parallax — foreground lines fly left/right violently */
      const dx = pull*dp*1.1 + absP*Math.sin(i*0.37+1.1)*0.18*Math.sign(pull||1);

      /* Y: lines shift vertically by their depth plane */
      const dy = textStartY + i*lineH + pull*(0.72 + dp*0.6);

      /* Skew: heavy misregistration at high pull */
      const skew = pull*dp*0.008;

      ctx.save();
      ctx.translate(baseX+dx, dy);
      ctx.scale(sc,sc);
      if(Math.abs(skew)>0.0001) ctx.transform(1,0,skew/sc,1,0,0);
      ctx.fillText(line,0,0);
      ctx.restore();
    });
  };

  drawSpatialCol(COL1,px+16);
  drawSpatialCol(COL2,px+colW+24);

  ctx.restore();
  cmdBox(ctx,W,H,'SCROLL_LOCKED = true');
  xhair(ctx,cv);
}

/* ═══════════════════════════════════════════════════════════════
   SELECTION — aggressive multiplication, accumulates forever
═══════════════════════════════════════════════════════════════ */
const SEED=['A','B','C','D','E'];
const EDGE_COLORS=[PINK,'#c8c8c6',PINK,'#c8c8c6'];

function initSelection(){
  DATA.sel.nodes=[];DATA.sel.edges=[];DATA.sel.clicks=0;DATA.sel.nextId=0;DATA.sel.inited=true;
  const cv=$('cv-selection');if(!cv) return;
  const W=cv.parentElement.offsetWidth||window.innerWidth;
  const H=cv.parentElement.offsetHeight||window.innerHeight;
  const bw=94,gap=10,total=SEED.length*(bw+gap)-gap;
  const sx=W/2-total/2;
  SEED.forEach((lbl,i)=>addSelNode(sx+i*(bw+gap)+bw/2,H*0.5,null,lbl,true));
  if(!cv.dataset.wired){
    cv.dataset.wired='1';
    cv.addEventListener('click',e=>{const rb=cv.getBoundingClientRect();onSelClick(e.clientX-rb.left,e.clientY-rb.top);});
  }
}

function dpt(pid){if(pid==null) return 0;const p=DATA.sel.nodes.find(n=>n.id===pid);return p?1+dpt(p.parentId):1;}

function addSelNode(x,y,pid,label,still){
  const cv=$('cv-selection');if(!cv) return null;
  const W=cv.parentElement.offsetWidth||window.innerWidth;
  const H=cv.parentElement.offsetHeight||window.innerHeight;
  const id=DATA.sel.nextId++;
  const palette=[RECT,PINK,STAGE_LIME[2]];
  const bg=still?RECT:palette[id%3];
  DATA.sel.nodes.push({
    id,parentId:pid,
    x:clamp(x,4,W-170),y:clamp(y,H*0.04,H*0.95),
    vx:0,vy:0,label,text:label+'_SELECT',bg,w:0,h:FS+16,still:!!still
  });
  if(pid!=null) DATA.sel.edges.push({from:pid,to:id});
  return id;
}

function onSelClick(cx,cy){
  let hit=null;
  DATA.sel.nodes.forEach(n=>{if(!n.w) return;if(cx>=n.x&&cx<=n.x+n.w&&cy>=n.y-4&&cy<=n.y+n.h+4) hit=n;});
  DATA.sel.clicks++;
  const cv=$('cv-selection');if(!cv) return;
  const W=cv.parentElement.offsetWidth||window.innerWidth;
  const H=cv.parentElement.offsetHeight||window.innerHeight;
  const px=hit?hit.x+(hit.w||80)/2:W/2,py=hit?hit.y:H/2;
  const pl=hit?hit.label:'';
  /* Viral growth: 20 / 50 / 80+ per click — screen fills in 4 clicks */
  const count=DATA.sel.clicks===1?20:DATA.sel.clicks===2?50:Math.min(80,30+DATA.sel.clicks*18);
  const golden=Math.PI*(3-Math.sqrt(5));
  for(let i=0;i<count;i++){
    const ang=i*golden+rnd(-0.4,0.4);
    /* Wide spread: up to 600px radius — fills entire canvas */
    const dist=rnd(80,600);
    addSelNode(px+Math.cos(ang)*dist,py+Math.sin(ang)*dist,hit?.id??null,pl+(i+1),false);
  }
  /* Very high cap — nodes accumulate aggressively */
  if(DATA.sel.nodes.length>1000) DATA.sel.nodes.splice(SEED.length,20);
  if(DATA.sel.edges.length>1200) DATA.sel.edges.splice(0,20);
}

function renderSelection(cv){
  const r=sz(cv);if(!r) return;
  const {ctx,W,H}=r;ctx.clearRect(0,0,W,H);
  drawBg(ctx,W,H,2);
  const cvR=cv.getBoundingClientRect();
  const cxM=MX-cvR.left,cyM=MY-cvR.top;
  const chaos=DATA.sel.clicks>0;

  /* Edges — pink/gray alternating */
  DATA.sel.edges.forEach((e,ei)=>{
    const fn=DATA.sel.nodes.find(n=>n.id===e.from);
    const tn=DATA.sel.nodes.find(n=>n.id===e.to);
    if(!fn||!tn||!fn.w||!tn.w) return;
    ctx.strokeStyle=EDGE_COLORS[ei%EDGE_COLORS.length];
    ctx.lineWidth=0.9;
    ctx.beginPath();ctx.moveTo(fn.x+fn.w/2,fn.y+fn.h/2);ctx.lineTo(tn.x+tn.w/2,tn.y+tn.h/2);ctx.stroke();
  });

  /* Nodes */
  DATA.sel.nodes.forEach(n=>{
    if(!n.still&&chaos&&cxM>0){
      const dx=(n.x+(n.w||80)/2)-cxM,dy=(n.y+n.h/2)-cyM;
      const d=Math.hypot(dx,dy);
      if(d<120){const f=(120-d)/120;n.vx+=(dx/Math.max(d,1))*f*3.5;n.vy+=(dy/Math.max(d,1))*f*2.8;}
    }
    n.vx*=0.84;n.vy*=0.84;n.x+=n.vx;n.y+=n.vy;
    n.x=clamp(n.x,4,W-170);n.y=clamp(n.y,H*0.04,H*0.95);
    ctx.font=FM(FS);const tw=ctx.measureText(n.text).width;
    const bpx=10,bpy=7;n.w=tw+bpx*2;n.h=FS+bpy*2;
    ctx.fillStyle=n.bg;ctx.fillRect(n.x,n.y,n.w,n.h);
    ctx.fillStyle=BK;ctx.textBaseline='top';ctx.fillText(n.text,n.x+bpx,n.y+bpy);
  });

  cmdBox(ctx,W,H,chaos?'SELECTION IS PREDETERMINED':'SELECT ONE OPTION');
  xhair(ctx,cv);
}

/* ═══════════════════════════════════════════════════════════════
   READABILITY — kept as-is, cmdBox moved outside rect via drawUI
═══════════════════════════════════════════════════════════════ */
const READ_TXT=
`The user agrees to read all material presented within this interface.
Content visible on screen is not guaranteed to remain legible at any time.
readability.guaranteed === false. Text may shift, enlarge, or overlap without
prior notice. Meaning may not remain accessible. The system controls display.
Some words will be enlarged beyond the bounds of this paragraph entirely.
Some characters will push forward in spatial depth beyond visible area.
comprehension.status → undefined. visibility ≠ legibility.
display.render(content) !== understand(content) in this system.
The system does not guarantee coherent reading at any moment in time.
Failure to comprehend does not exempt the user from this agreement.
Text rendered in this section is subject to spatial transformation.
Certain words may undergo extreme scale changes without any prior notice.
Perspective shifts or positional displacement may occur at any time.
meaning.accessible === false at the sole discretion of the system.
The paragraph structure is maintained. Elements may exceed all boundaries.
This is expected behavior. comprehension.status → undefined at all times.
The user agrees to read all material presented within this interface.
Content visible on screen is not guaranteed to remain legible.
readability.guaranteed === false. Text may shift, enlarge, or overlap.
Meaning may not remain accessible. The system controls all display state.
Some words will be enlarged beyond the bounds of this paragraph completely.
Some characters will push forward in spatial depth beyond visible area.
comprehension.status → undefined. visibility ≠ legibility always.
display.render(content) !== understand(content). The system does not
guarantee coherent reading at any moment. Failure to comprehend does not
exempt the user. meaning.accessible === false at system discretion.
The paragraph structure is maintained but unstable at all times.
This is expected and intentional system behavior. status → undefined.
The user agrees to read all material within this interface continuously.
readability.guaranteed === false. display.render() !== understand().
Certain characters will push forward in spatial depth beyond visible area.
comprehension.status → undefined. visibility ≠ legibility. Always.
meaning.accessible === false. The system controls all display at all times.
Text rendered in this section is subject to violent spatial transformation.
Some words will be enlarged beyond the bounds of this paragraph entirely.
Perspective shifts will occur. Positional displacement will occur.
The paragraph structure is maintained but collapses under observation.`;

function initReadability(){
  if(DATA.read.interval){clearInterval(DATA.read.interval);DATA.read.interval=null;}
  DATA.read.eruptions=[];DATA.read.words=[];DATA.read.inited=true;
  const cv=$('cv-readability');if(!cv) return;
  const W=cv.parentElement.offsetWidth||window.innerWidth;
  const H=cv.parentElement.offsetHeight||window.innerHeight;
  const rx=W*RX_F+14,ry=H*RY_F+14;
  const rw=W*RW_F-28,colW=(rw-20)/2;
  const lineH=Math.round(FS*1.68);
  const tmp=document.createElement('canvas').getContext('2d');tmp.font=FM(FS);
  const lines=READ_TXT.split('\n');const half=Math.ceil(lines.length/2);
  [[lines.slice(0,half),rx],[lines.slice(half),rx+colW+20]].forEach(([ls,gx])=>{
    let gy=ry;
    ls.forEach(line=>{
      let cx2=gx;
      line.split(' ').forEach(word=>{
        if(!word) return;
        const tww=tmp.measureText(word+' ').width;
        DATA.read.words.push({text:word,gx:cx2,gy,ox:0,oy:0,vox:0,voy:0,scaleX:1,scaleY:1,skewX:rnd(-0.04,0.04),baseFs:FS,currentFs:FS});
        cx2+=tww;
      });
      gy+=lineH;
    });
  });
  DATA.read.interval=setInterval(()=>{
    if(activeStage!==3) return;
    for(let i=0;i<Math.floor(rnd(4,8));i++){
      const idx=Math.floor(Math.random()*DATA.read.words.length);
      /* Direction: pick from all quadrants — left/right/up/down/diagonal */
      const dirAngle=rnd(0,Math.PI*2);
      const dirDist=rnd(180,420);
      DATA.read.eruptions.push({
        wordIdx:idx,
        targetFs:rnd(90,380),      /* wider range — some huge, some small */
        targetSX:rnd(0.3,7),       /* can also shrink (0.3) or explode (7) */
        targetSY:rnd(0.2,6),
        targetSkew:rnd(-0.7,0.7),
        /* All directions: left, right, up, down, diagonal */
        targetOx:Math.cos(dirAngle)*dirDist,
        targetOy:Math.sin(dirAngle)*dirDist,
        born:performance.now(),
        dur:rnd(350,1400)
      });
    }
    if(DATA.read.eruptions.length>28) DATA.read.eruptions.splice(0,DATA.read.eruptions.length-28);
  },420);
}

function renderReadability(cv){
  const r=sz(cv);if(!r) return;
  const {ctx,W,H}=r;ctx.clearRect(0,0,W,H);
  drawBg(ctx,W,H,3);
  if(!DATA.read.words.length) return;
  const now=performance.now();
  const cvR=cv.getBoundingClientRect();
  const cx=MX-cvR.left,cy=MY-cvR.top;
  DATA.read.eruptions.forEach(e=>{
    const w=DATA.read.words[e.wordIdx];if(!w) return;
    const age=(now-e.born)/e.dur;if(age>1) return;
    const boom=Math.sin(age*Math.PI);
    w.currentFs=lerp(w.baseFs,e.targetFs,boom);
    w.scaleX=lerp(1,e.targetSX,boom);w.scaleY=lerp(1,e.targetSY,boom);
    w.skewX=lerp(w.skewX,e.targetSkew,boom*0.7);
    w.vox+=(e.targetOx*boom-w.ox)*0.15;w.voy+=(e.targetOy*boom-w.oy)*0.15;
  });
  DATA.read.eruptions=DATA.read.eruptions.filter(e=>(now-e.born)<e.dur+80);
  DATA.read.words.forEach(w=>{
    if(cx>0){
      const wx2=w.gx+w.ox,wy2=w.gy+w.oy;
      const d=Math.hypot(wx2-cx,wy2-cy);
      if(d<150){const f=(150-d)/150;w.vox+=(wx2-cx)*f*0.12;w.voy+=(wy2-cy)*f*0.09;w.currentFs=lerp(w.currentFs,w.baseFs*5,f*0.4);}
    }
    w.vox+=(0-w.ox)*0.052;w.voy+=(0-w.oy)*0.052;w.vox*=0.74;w.voy*=0.74;
    w.ox+=w.vox;w.oy+=w.voy;
    w.currentFs+=(w.baseFs-w.currentFs)*0.038;
    w.scaleX+=(1-w.scaleX)*0.042;w.scaleY+=(1-w.scaleY)*0.042;
    ctx.save();ctx.translate(w.gx+w.ox,w.gy+w.oy);
    ctx.transform(1,0,w.skewX,w.scaleY,0,0);ctx.scale(w.scaleX,1);
    ctx.font=FM(w.currentFs);ctx.fillStyle=BK;ctx.textBaseline='top';ctx.fillText(w.text,0,0);
    ctx.restore();
  });
  cmdBox(ctx,W,H,'READABILITY — visibility ≠ legibility');
  xhair(ctx,cv);
}

/* ═══════════════════════════════════════════════════════════════
   NAVIGATION — module follows cursor, trails, PINK selection boxes
   RETURN TO PREVIOUS PAGE + SKIP TO NEXT PAGE as pink boxes
═══════════════════════════════════════════════════════════════ */
const NAV_LINES=[
  '#04 NAVIGATION','',
  'Movement does not constitute directional freedom.',
  'navigation.update(cursor_position) — access: denied.',
  'next_button.follow(user_input) — non-binding instruction.',
  'movement !== access. Path forward is acknowledged.',
  'Restricted pathways enforced at the system level.',
  'Cursor-following does not imply navigation.',
  'repositioning.request() logged and discarded.',
  'navigation.locked = true. direction → access.denied.',
  'All movement recorded. Access remains unavailable.',
];

function initNavigation(){
  const W=window.innerWidth,H=window.innerHeight;
  DATA.nav.x=W*RX_F;DATA.nav.y=H*RY_F;DATA.nav.vx=0;DATA.nav.vy=0;DATA.nav.trails=[];DATA.nav.inited=true;
}

function renderNavigation(cv){
  const r=sz(cv);if(!r) return;
  const {ctx,W,H}=r;ctx.clearRect(0,0,W,H);
  drawBg(ctx,W,H,4);
  const cvR=cv.getBoundingClientRect();
  const cx=MX-cvR.left,cy=MY-cvR.top;
  const lime=STAGE_LIME[4];
  const now=performance.now();

  /* Measure paragraph width at FS */
  ctx.font=FM(FS);
  let maxW=0;NAV_LINES.forEach(l=>{maxW=Math.max(maxW,ctx.measureText(l).width);});
  const padX=16,padY=12,lineH=Math.round(FS*1.8);
  const blockW=Math.min(maxW+padX*2,W*RW_F);
  const blockH=NAV_LINES.length*lineH+padY*2;

  /* Button geometry — sentence case, same FS, left-aligned to paragraph */
  const btnTxt1='Return to previous page';
  const btnTxt2='Skip to next page';
  const btnH=FS+16,btnGap=10;
  /* Each button: exactly half the block width minus gap */
  const halfW=(blockW-btnGap)/2;
  const totalH=blockH+btnGap+btnH;

  /* Top-left of module tracks cursor — whole block slides together */
  if(cx>0){DATA.nav.vx+=(cx-DATA.nav.x)*0.052;DATA.nav.vy+=(cy-DATA.nav.y)*0.052;}
  else{DATA.nav.vx+=(W*RX_F-DATA.nav.x)*0.04;DATA.nav.vy+=(H*RY_F-DATA.nav.y)*0.04;}
  DATA.nav.vx*=0.74;DATA.nav.vy*=0.74;
  DATA.nav.x+=DATA.nav.vx;DATA.nav.y+=DATA.nav.vy;
  DATA.nav.x=clamp(DATA.nav.x,W*RX_F,W*(RX_F+RW_F)-blockW);
  DATA.nav.y=clamp(DATA.nav.y,H*RY_F,H*(RY_F+RH_F)-totalH-4);

  /* Trails */
  const speed=Math.hypot(DATA.nav.vx,DATA.nav.vy);
  if(speed>0.5) DATA.nav.trails.push({x:DATA.nav.x,y:DATA.nav.y,born:now});
  if(DATA.nav.trails.length>60) DATA.nav.trails.shift();
  DATA.nav.trails.forEach(tr=>{
    const age=(now-tr.born)/3500;
    const alpha=Math.max(0,0.22-age*0.22);
    ctx.save();ctx.globalAlpha=alpha;
    ctx.strokeStyle=lime;ctx.lineWidth=1;
    ctx.strokeRect(tr.x,tr.y,blockW,blockH);
    ctx.restore();
  });

  /* Paragraph block */
  ctx.fillStyle=lime;ctx.fillRect(DATA.nav.x,DATA.nav.y,blockW,blockH);
  ctx.font=FM(FS);ctx.fillStyle=BK;ctx.textBaseline='top';
  NAV_LINES.forEach((line,i)=>{
    if(!line) return;
    if(i===0){ctx.font=FM(FSL);ctx.fillText(line,DATA.nav.x+padX,DATA.nav.y+padY+i*lineH);ctx.font=FM(FS);}
    else ctx.fillText(line,DATA.nav.x+padX,DATA.nav.y+padY+i*lineH);
  });

  /* Buttons — pale pink, sentence case, FS, left-aligned to block left edge */
  const btnY=DATA.nav.y+blockH+btnGap;
  const bpy2=(btnH-FS)/2;
  ctx.font=FM(FS);

  /* BUTTON 1: left edge = DATA.nav.x (same as paragraph) */
  ctx.fillStyle=PINK;ctx.fillRect(DATA.nav.x,btnY,halfW,btnH);
  ctx.save();
  ctx.beginPath();ctx.rect(DATA.nav.x,btnY,halfW,btnH);ctx.clip();
  ctx.fillStyle=BK;ctx.textBaseline='top';
  ctx.fillText(btnTxt1,DATA.nav.x+UI_PX,btnY+bpy2);
  ctx.restore();

  /* BUTTON 2: left edge = DATA.nav.x + halfW + gap */
  const btn2X=DATA.nav.x+halfW+btnGap;
  ctx.fillStyle=PINK;ctx.fillRect(btn2X,btnY,halfW,btnH);
  ctx.save();
  ctx.beginPath();ctx.rect(btn2X,btnY,halfW,btnH);ctx.clip();
  ctx.fillStyle=BK;ctx.textBaseline='top';
  ctx.fillText(btnTxt2,btn2X+UI_PX,btnY+bpy2);
  ctx.restore();

  cmdBox(ctx,W,H,'NAVIGATION — movement !== access');
  xhair(ctx,cv);
}

/* ═══════════════════════════════════════════════════════════════
   EXIT — 3D door-fold effect
   At rest: two buttons appear as flat lime boxes, side by side.
   On hover EXIT: left edge is hinge — rect folds inward (rotateY)
   On hover STAY: right edge is hinge — rect folds from opposite side.
   Uses CSS 3D perspective on DOM buttons + canvas background.
═══════════════════════════════════════════════════════════════ */
function initExit(){if(DATA.exit.inited) return;DATA.exit.inited=true;wireExitButtons();}

function wireExitButtons(){
  const be=$('btn-exit'),bs=$('btn-stay');if(!be||be.dataset.wired) return;
  be.dataset.wired='1';bs.dataset.wired='1';
  DATA.exit.efold=0;DATA.exit.sfold=0;

  be.addEventListener('click',e=>{
    e.preventDefault();DATA.exit.tries++;
    if(DATA.exit.tries>=4){setTimeout(()=>{const idx=allSections.findIndex(s=>s.id==='s-bottom');if(idx>=0) snapToIndex(idx,true);},400);}
  });
  bs.addEventListener('click',e=>{e.preventDefault();setTimeout(()=>{window.location.href='https://jiminhur.github.io/RSD3_jimin.h.k_Collection/';},300);});
}

function updateExit(){
  if(!$('btn-exit')) return;
  const be=$('btn-exit'),bs=$('btn-stay');

  /* EXIT — left-edge hinge. Folds AWAY from viewer (door opens inward into depth).
     rotateY negative = left side moves away. translateZ negative = recedes. */
  const beR=be.getBoundingClientRect();
  const beD=MX>0?Math.hypot(beR.left+beR.width/2-MX,beR.top+beR.height/2-MY):999;
  const eFold=MX>0&&beD<220?Math.max(0,(220-beD)/220):0;
  DATA.exit.efold=lerp(DATA.exit.efold,eFold,0.10);
  /* Fold inward: rotateY goes negative (left hinge, right side recedes away).
     translateZ stays negative — always pushes into depth, never toward viewer. */
  const eAng=DATA.exit.efold*-82;
  be.style.transformOrigin='left center';
  be.style.transition='transform .06s linear';
  be.style.transform=`perspective(700px) rotateY(${eAng}deg) translateZ(${DATA.exit.efold*-80}px)`;

  /* STAY — right-edge hinge. Folds AWAY from viewer in opposite direction. */
  const bsR=bs.getBoundingClientRect();
  const bsD=MX>0?Math.hypot(bsR.left+bsR.width/2-MX,bsR.top+bsR.height/2-MY):999;
  const sFold=MX>0&&bsD<220?Math.max(0,(220-bsD)/220):0;
  DATA.exit.sfold=lerp(DATA.exit.sfold,sFold,0.10);
  /* Right hinge: rotateY positive folds right side away into depth. */
  const sAng=DATA.exit.sfold*82;
  bs.style.transformOrigin='right center';
  bs.style.transition='transform .06s linear';
  bs.style.transform=`perspective(700px) rotateY(${sAng}deg) translateZ(${DATA.exit.sfold*-80}px)`;
}

function renderExit(cv){
  const r=sz(cv);if(!r) return;
  const {ctx,W,H}=r;ctx.clearRect(0,0,W,H);
  drawBg(ctx,W,H,5);
  cmdBox(ctx,W,H,'EXIT — system.retains(control)');
  xhair(ctx,cv);
}

/* ═══════════════════════════════════════════════════════════════
   RENDERERS + LOOP
═══════════════════════════════════════════════════════════════ */
const RENDERERS={
  scrolling:renderScrolling,selection:renderSelection,
  readability:renderReadability,navigation:renderNavigation,exit:renderExit
};

function loop(){
  try{
    T+=0.016;FC++;tickLock();
    if(FC%2===0){
      SDEFS.forEach(s=>{
        const cv=$('cv-'+s.id);if(!cv?.parentElement) return;
        const rb=cv.getBoundingClientRect();
        if(rb.bottom>0&&rb.top<window.innerHeight) RENDERERS[s.id](cv);
      });
      const gv=$('cv-game');
      if(gv){const rb=gv.getBoundingClientRect();if(rb.bottom>0&&rb.top<window.innerHeight) renderGame(gv);}
      if(activeStage===5) updateExit();
    }
    renderMag();
  }catch(e){console.warn('loop:',e);}
  requestAnimationFrame(loop);
}

function renderMag(){
  const mag=$('mag');if(!mag) return;
  if(MX<0){mag.style.left='-100px';return;}
  magX+=(MX-magX)*0.22;magY+=(MY-magY)*0.22;
  mag.style.left=(magX-22)+'px';mag.style.top=(magY-22)+'px';
}
