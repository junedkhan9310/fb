const STORAGE_KEYS = {
  bg: 'fb_bg',
  bird: 'fb_bird',
  pipe: 'fb_pipe',
  music: 'fb_music',
  ouch: 'fb_ouch'
};

const DEFAULT_ASSETS = {
  bg: 'data/background.jpg',
  bird: 'data/bird.png',
  pipe: 'data/pipe.jpg',
  music: 'data/music.mp3',
  ouch: 'data/ouch.mp3'
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const messageEl = document.getElementById('message');
const gameOverEl = document.getElementById('game-over');
const finalScoreEl = document.getElementById('final-score');
const btnRestart = document.getElementById('btn-restart');

const modal = document.getElementById('modal');
const btnCustomize = document.getElementById('btn-customize');
const btnClose = document.getElementById('btn-close');
const btnReset = document.getElementById('btn-reset');
const btnClearUploads = document.getElementById('btn-clear-uploads');
const btnMute = document.getElementById('btn-mute');
const btnStart = document.getElementById('btn-start');

const fileBg = document.getElementById('file-bg');
const fileBird = document.getElementById('file-bird');
const filePipe = document.getElementById('file-pipe');
const fileMusic = document.getElementById('file-music');
const fileOuch = document.getElementById('file-ouch');

const previewBg = document.getElementById('preview-bg');
const previewBird = document.getElementById('preview-bird');
const previewPipe = document.getElementById('preview-pipe');
const previewMusic = document.getElementById('preview-music');
const previewOuch = document.getElementById('preview-ouch');

let muted = false;
let running = false;
let started = false;
let gameOver = false;
let score = 0;

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

const assets = {
  bgImg: new Image(),
  birdImg: new Image(),
  pipeImg: new Image(),
  musicAudio: new Audio(),
  ouchAudio: new Audio()
};

function getStoredOrDefault(key, def) {
  const stored = localStorage.getItem(STORAGE_KEYS[key]);
  return stored || def;
}

function loadAllAssets() {
  assets.bgImg.src = getStoredOrDefault('bg', DEFAULT_ASSETS.bg);
  assets.birdImg.src = getStoredOrDefault('bird', DEFAULT_ASSETS.bird);
  assets.pipeImg.src = getStoredOrDefault('pipe', DEFAULT_ASSETS.pipe);
  assets.musicAudio.src = getStoredOrDefault('music', DEFAULT_ASSETS.music);
  assets.ouchAudio.src = getStoredOrDefault('ouch', DEFAULT_ASSETS.ouch);
  assets.musicAudio.loop = true;
  previewBg.src = assets.bgImg.src;
  previewBird.src = assets.birdImg.src;
  previewPipe.src = assets.pipeImg.src;
  previewMusic.src = assets.musicAudio.src;
  previewOuch.src = assets.ouchAudio.src;
}

function applyAsset(key, dataUrl) {
  if (dataUrl?.startsWith('data:')) {
    localStorage.setItem(STORAGE_KEYS[key], dataUrl);
  }
  switch (key) {
    case 'bg': assets.bgImg.src = dataUrl || DEFAULT_ASSETS.bg; previewBg.src = assets.bgImg.src; break;
    case 'bird': assets.birdImg.src = dataUrl || DEFAULT_ASSETS.bird; previewBird.src = assets.birdImg.src; break;
    case 'pipe': assets.pipeImg.src = dataUrl || DEFAULT_ASSETS.pipe; previewPipe.src = assets.pipeImg.src; break;
    case 'music': assets.musicAudio.src = dataUrl || DEFAULT_ASSETS.music; previewMusic.src = assets.musicAudio.src; assets.musicAudio.loop = true; if (!muted) tryEnableMusic(); break;
    case 'ouch': assets.ouchAudio.src = dataUrl || DEFAULT_ASSETS.ouch; previewOuch.src = assets.ouchAudio.src; break;
  }
}

function resetToDefaults() {
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  loadAllAssets();
  assets.musicAudio.pause();
  if (!muted) tryEnableMusic();
}

function fileToDataUrl(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// Uploads
[fileBg, fileBird, filePipe, fileMusic, fileOuch].forEach((input, i) => {
  const keys = ['bg','bird','pipe','music','ouch'];
  input.addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    const data = await fileToDataUrl(f);
    applyAsset(keys[i], data);
  });
});

btnClearUploads.addEventListener('click', () => {
  [fileBg, fileBird, filePipe, fileMusic, fileOuch].forEach(f=>f.value='');
});

const bird = {x:120,y:200,velY:0,radius:18};
let gravity=0.75, jump=-12;
const pipes=[], PIPE_WIDTH=90, PIPE_INTERVAL=1600;
let lastPipeSpawn=0, pipeSpeed=3;

function randomRange(a,b){return Math.floor(a+Math.random()*(b-a));}
function createPipe(){
  const gap=randomRange(130,220);
  const top=randomRange(80,canvas.height-200-gap);
  pipes.push({x:canvas.width+40,w:PIPE_WIDTH,top,gap,scored:false});
}
function resetGame(){
  pipes.length=0; bird.x=canvas.width*0.2; bird.y=canvas.height/2; bird.velY=0;
  score=0; scoreEl.textContent=score; started=false; gameOver=false;
  messageEl.classList.remove('hidden'); gameOverEl.classList.add('hidden');
  lastPipeSpawn=performance.now()+800;
}

function circleRectCollision(cx,cy,r,rect){
  const x=Math.max(rect.x,Math.min(cx,rect.x+rect.w));
  const y=Math.max(rect.y,Math.min(cy,rect.y+rect.h));
  const dx=cx-x, dy=cy-y;
  return dx*dx+dy*dy<=r*r;
}

function checkCollision(){
  if(bird.y-bird.radius<0||bird.y+bird.radius>canvas.height)return true;
  for(const p of pipes){
    const top={x:p.x,y:0,w:p.w,h:p.top};
    const bot={x:p.x,y:p.top+p.gap,w:p.w,h:canvas.height-(p.top+p.gap)};
    if(circleRectCollision(bird.x,bird.y,bird.radius,top)||circleRectCollision(bird.x,bird.y,bird.radius,bot)) return true;
  }
  return false;
}

function flap(){ if(gameOver)return; bird.velY=jump; started=true; messageEl.classList.add('hidden'); if(!muted)tryEnableMusic(); }
function playOuch(){ if(!muted){assets.ouchAudio.currentTime=0;assets.ouchAudio.play();}}
function tryEnableMusic(){assets.musicAudio.play().catch(()=>{});}
function pauseMusic(){assets.musicAudio.pause();}

window.addEventListener('keydown',e=>{if(e.code==='Space'){if(gameOver){restart();return;} flap();}});
canvas.addEventListener('mousedown',flap);
canvas.addEventListener('touchstart',flap,{passive:true});

btnMute.addEventListener('click',()=>{muted=!muted;btnMute.textContent=muted?'Unmute':'Mute';if(muted)pauseMusic();else tryEnableMusic();});
btnRestart.addEventListener('click',()=>restart());
btnStart.addEventListener('click',()=>restart());

function restart(){resetGame();if(!muted)tryEnableMusic();}
let lastTime=performance.now();

function update(dt){
  if(!started||gameOver)return;
  bird.velY+=gravity; bird.y+=bird.velY;
  for(const p of pipes){
    p.x-=pipeSpeed;
    if(!p.scored && p.x+p.w<bird.x){p.scored=true;score++;scoreEl.textContent=score;}
  }
  while(pipes.length&&pipes[0].x+pipes[0].w<-100)pipes.shift();
  const now=performance.now();
  if(now-lastPipeSpawn>PIPE_INTERVAL){createPipe();lastPipeSpawn=now;}
  if(checkCollision()){gameOver=true;gameOverEl.classList.remove('hidden');finalScoreEl.textContent='Score: '+score;playOuch();pauseMusic();}
}

function draw(){
  ctx.drawImage(assets.bgImg,0,0,canvas.width,canvas.height);
  for(const p of pipes){
    ctx.drawImage(assets.pipeImg,0,0,assets.pipeImg.width,assets.pipeImg.height,p.x,0,p.w,p.top);
    ctx.drawImage(assets.pipeImg,0,0,assets.pipeImg.width,assets.pipeImg.height,p.x,p.top+p.gap,p.w,canvas.height-(p.top+p.gap));
  }
  const w=bird.radius*2.2,h=w;
  ctx.save();
  ctx.translate(bird.x,bird.y);
  ctx.rotate(Math.max(-Math.PI/6,Math.min(Math.PI/4,bird.velY*0.05)));
  ctx.drawImage(assets.birdImg,-w/2,-h/2,w,h);
  ctx.restore();
}

function loop(ts){const dt=ts-lastTime;lastTime=ts;update(dt);draw();requestAnimationFrame(loop);}
btnCustomize.addEventListener('click',()=>{modal.classList.remove('hidden');});
btnClose.addEventListener('click',()=>{modal.classList.add('hidden');});
btnReset.addEventListener('click',()=>{if(confirm('Reset all custom assets?'))resetToDefaults();});
modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.add('hidden');});

loadAllAssets();
resetGame();
requestAnimationFrame(loop);
