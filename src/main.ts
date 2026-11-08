import { Application, Container, Sprite, Texture, Graphics, Text } from 'pixi.js';
import { TiledMapRenderer } from './TiledMapRenderer';
import { sceneFrameBufs, SCENE_W, SCENE_H, type OfficeCharacterName } from './portraitArt';
import officeMapRaw from '/public/maps/office.tmj?raw';

type AgentState = 'idle' | 'writing' | 'thinking' | 'calling_tool' | 'error' | 'dead_loop' | 'success';
interface TraceStep { time: string; action: string; }
interface Employee {
  id: string; name: string; role: string;
  spawn: string; state: AgentState; cast: OfficeCharacterName;
  task: string; progress: number; priority: 'H' | 'M' | 'L';
  targetX: number; targetY: number; walking: boolean;
  path: { x: number; y: number }[]; pathIdx: number;
  trace: TraceStep[]; tokens: number;
}

const TASK_POOL = [
  'Fix login bug', 'Optimize DB', 'Deploy staging',
  'Code review PR', 'Spec API', 'Build ETL',
  'Redesign dashboard', 'Write tests', 'Refactor auth',
  'Migrate data', 'Setup CI/CD', 'Debug payment',
];
function now(): string { return new Date().toTimeString().slice(0, 8); }

const EMPLOYEES: Employee[] = TASK_POOL.slice(0, 8).map((task, i) => ({
  id: `agent_${i + 1}`,
  name: ['Alice','Bob','Charlie','Diana','Evan','Fiona','George','Hannah'][i],
  role: ['Frontend','Backend','DevOps','QA','Tech Lead','Product','Data','UX'][i],
  spawn: ['pc-1','pc-2','pc-3','pc-4','desk-team-lead','desk-backend-engineer','desk-product-manager','desk-data-engineer'][i],
  state: 'idle' as AgentState,
  cast: ['pam','jim','ryan','angela','dwight','michael','kevin','phyllis'][i] as OfficeCharacterName,
  task, progress: Math.floor(Math.random() * 80),
  priority: (['H','M','L'] as const)[Math.floor(Math.random() * 3)],
  targetX: 0, targetY: 0, walking: false,
  path: [], pathIdx: 0,
  trace: [{ time: now(), action: `Start: ${task}` }],
  tokens: Math.floor(Math.random() * 500) + 100,
}));

const STATE_THOUGHT: Record<string, string> = {
  idle: '待命…', writing: '写代码…', thinking: '思考…',
  calling_tool: '调用工具…', error: '报错！', dead_loop: '死循环…', success: '完成！',
};
const STATE_ICON: Record<string, string> = {
  idle: '💤', writing: '💻', thinking: '💭',
  calling_tool: '🔧', error: '❗', dead_loop: '🔄', success: '✨',
};
const STATE_COLOR: Record<string, number> = {
  idle: 0x555566, writing: 0x00d4ff, thinking: 0xb46bff,
  calling_tool: 0x00ff88, error: 0xff3366, dead_loop: 0xffcc00, success: 0x00ff66,
};
const STATE_LABEL: Record<string, string> = {
  idle: 'IDLE', writing: 'WRITING', thinking: 'THINKING',
  calling_tool: 'CALLING', error: 'ERROR', dead_loop: 'DEAD LOOP', success: 'DONE',
};
const STATE_BUBBLE: Record<string, { bg: number; fg: number; border: number }> = {
  idle: { bg: 0x222233, fg: 0xaaaaaa, border: 0x666666 }, writing: { bg: 0x0a0a22, fg: 0x00ffff, border: 0x00ffff },
  thinking: { bg: 0x0a1a33, fg: 0x66aaff, border: 0x3388ff }, calling_tool: { bg: 0x0a2211, fg: 0x44ff88, border: 0x22cc66 },
  error: { bg: 0x330a0a, fg: 0xff6666, border: 0xff3333 }, dead_loop: { bg: 0x332a0a, fg: 0xffcc44, border: 0xffaa22 },
  success: { bg: 0x0a2a1a, fg: 0x66ffaa, border: 0x33dd88 },
};
const C = { bg: 0x0a0a14, panelBg: 0x111122, panelBg2: 0x1a1a33, border: 0xff00ff, text: 0x80f0ff, textDim: 0x9999cc, accent: 0xff00ff };

function makeBubble(text: string, state: string): Container {
  const c = new Container();
  const colors = STATE_BUBBLE[state] || STATE_BUBBLE.idle;
  const icon = STATE_ICON[state] || '';
  // Pokemon-style: compact, rounded, centered
  const maxW = 80;
  const iconTxt = new Text({ text: icon, style: { fontSize: 8 } });
  const shortText = text.length > 12 ? text.slice(0, 10) + '…' : text;
  const labelTxt = new Text({ text: shortText, style: { fontFamily: 'sans-serif', fontSize: 7, fill: colors.fg, fontWeight: 'bold', wordWrap: true, wordWrapWidth: maxW, lineHeight: 9 } });
  const pad = 4;
  const w = Math.max(iconTxt.width + 3 + labelTxt.width, maxW) + pad*2;
  const h = Math.max(iconTxt.height, labelTxt.height) + pad*2;
  const g = new Graphics();
  g.roundRect(-w/2, -(h+3), w, h, 4).fill({ color: colors.bg, alpha: 0.95 }).stroke({ color: colors.border, width: 1.5 });
  g.moveTo(-2, -3).lineTo(2, -3).lineTo(0, 0).closePath().fill({ color: colors.bg, alpha: 0.95 });
  iconTxt.position.set(-w/2+pad, -(h+3)+pad + (h-iconTxt.height)/2);
  labelTxt.position.set(-w/2+pad+iconTxt.width+3, -(h+3)+pad + (h-labelTxt.height)/2);
  c.addChild(g, iconTxt, labelTxt);
  return c;
}

function bufToTexture(buf: Uint8ClampedArray): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = SCENE_W; canvas.height = SCENE_H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(SCENE_W, SCENE_H);
  img.data.set(buf); ctx.putImageData(img, 0, 0);
  const tex = Texture.from(canvas); tex.source.scaleMode = 'nearest';
  return tex;
}
async function loadTexture(url: string): Promise<Texture> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(Texture.from(img));
    img.onerror = () => reject(new Error('fail: ' + url));
    img.src = url;
  });
}

function sciPanel(g: Graphics, x: number, y: number, w: number, h: number, bc: number = C.border) {
  g.rect(x, y, w, h).fill({ color: C.panelBg, alpha: 0.95 });
  g.rect(x, y, w, h).stroke({ color: bc, alpha: 0.7, width: 1.5 });
  g.moveTo(x, y).lineTo(x+w, y).stroke({ color: C.text, alpha: 0.4, width: 1 });
}

const eventLog: { time: string; text: string; color: number }[] = [];
const taskHistory: { name: string; agent: string; time: string; tokens: number; ok: boolean }[] = [];
let paused = false;

async function main() {
  const app = new Application();
  await app.init({ resizeTo: window, background: C.bg, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true });
  document.getElementById('app')!.appendChild(app.canvas);

  const W = app.screen.width, H = app.screen.height;
  const TOP_H = 48, BOT_H = 90, LEFT_W = 200, RIGHT_W = 260;
  const MID_W = W - LEFT_W - RIGHT_W;
  const MID_H = H - TOP_H - BOT_H;

  // ===== TOP BAR =====
  const topBar = new Container(); topBar.position.set(0, 0); app.stage.addChild(topBar);
  const topBg = new Graphics(); sciPanel(topBg, 0, 0, W, TOP_H, C.border); topBar.addChild(topBg);
  const titleText = new Text({ text: '◆ AGENT CONTROL ◆', style: { fontFamily: 'monospace', fontSize: 16, fill: C.accent, fontWeight: 'bold' } });
  titleText.position.set(10, 14); topBar.addChild(titleText);
  const searchBox = new Graphics();
  searchBox.roundRect(210, 10, 140, 26, 3).fill({ color: 0x0a0a14 }).stroke({ color: C.border, alpha: 0.3, width: 1 });
  topBar.addChild(searchBox);
  const searchTxt = new Text({ text: '🔍 search...', style: { fontFamily: 'monospace', fontSize: 10, fill: C.textDim } });
  searchTxt.position.set(218, 16); topBar.addChild(searchTxt);
  const adapterColors = [0x00ffff, 0xff00ff, 0x9d00ff];
  ['CrewAI','OTel','Langfuse'].forEach((label, i) => {
    const ax = 380 + i * 80;
    const dg = new Graphics(); dg.circle(ax, 23, 3.5).fill({ color: adapterColors[i] }); dg.circle(ax, 23, 6).fill({ color: adapterColors[i], alpha: 0.3 });
    topBar.addChild(dg);
    const txt = new Text({ text: label, style: { fontFamily: 'monospace', fontSize: 10, fill: 0xffffff, alpha: 0.7 } });
    txt.position.set(ax+8, 18); topBar.addChild(txt);
  });
  const statsText = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 11, fill: C.text, fontWeight: 'bold' } });
  statsText.position.set(630, 18); topBar.addChild(statsText);
  const hintTxt = new Text({ text: 'G=grid  D=detail  F11=big', style: { fontFamily: 'monospace', fontSize: 9, fill: C.textDim, alpha: 0.6 } });
  hintTxt.position.set(W-180, 18); topBar.addChild(hintTxt);
  // Alert bell
  const alertBell = new Text({ text: '🔔', style: { fontFamily: 'monospace', fontSize: 14, fill: 0x666666 } });
  alertBell.position.set(W-220, 14); topBar.addChild(alertBell);
  const alertCount = new Text({ text: '0', style: { fontFamily: 'monospace', fontSize: 8, fill: 0xffffff, fontWeight: 'bold' } });
  alertCount.position.set(W-205, 14); topBar.addChild(alertCount);
  alertBell.eventMode = 'static'; alertBell.cursor = 'pointer';
  const alertPanel = new Graphics();
  alertPanel.position.set(W - 280, 40);
  alertPanel.visible = false;
  topBar.addChild(alertPanel);
  const alertListText = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 8, fill: C.text, wordWrap: true, wordWrapWidth: 260, lineHeight: 14 } });
  alertListText.position.set(10, 10);
  alertPanel.addChild(alertListText);
  let panelOpen = false;
  alertBell.on('pointertap', () => {
    panelOpen = !panelOpen;
    alertPanel.visible = panelOpen;
    if (panelOpen) {
      const alerts = EMPLOYEES.map((e, i) => ({ i, name: e.name, state: e.state })).filter(e => e.state === 'error' || e.state === 'dead_loop');
      let txt = '⚠️ ALERTS (' + alerts.length + ')\n';
      alerts.forEach((a, idx) => {
        const color = a.state === 'error' ? '🔴' : '🟡';
        txt += `${color} ${a.name} - ${a.state}  [×]\n`;
      });
      txt += `\n[ALL CLEAR]  [close]`;
      alertListText.text = txt;
      const h = 20 + alerts.length * 14 + 30;
      alertPanel.clear();
      alertPanel.rect(0, 0, 260, h).fill({ color: 0x111122 });
      alertPanel.rect(0, 0, 260, h).stroke({ color: C.border, alpha: 0.7, width: 1.5 });
    }
  });
  // Click on alert panel to clear first alert
  alertPanel.eventMode = 'static';
  alertPanel.on('pointertap', () => {
    const firstErr = EMPLOYEES.findIndex(e => e.state === 'error' || e.state === 'dead_loop');
    if (firstErr >= 0) {
      EMPLOYEES[firstErr].state = 'idle';
      EMPLOYEES[firstErr].progress = 0;
      panelOpen = false;
      alertPanel.visible = false;
    }
  });

  // ===== LEFT SIDEBAR =====
  const sidebar = new Container(); sidebar.position.set(0, TOP_H); app.stage.addChild(sidebar);
  const sbBg = new Graphics(); sciPanel(sbBg, 0, 0, LEFT_W, MID_H, C.accent); sidebar.addChild(sbBg);
  const filterTitle = new Text({ text: '▌ AGENTS', style: { fontFamily: 'monospace', fontSize: 11, fill: C.text, fontWeight: 'bold' } });
  filterTitle.position.set(6, 4); sidebar.addChild(filterTitle);
  const filterBtns = new Text({ text: '[ALL] ACTIVE ERR DEAD', style: { fontFamily: 'monospace', fontSize: 8, fill: C.textDim } });
  filterBtns.position.set(6, 18); sidebar.addChild(filterBtns);
  const pauseBtn = new Text({ text: '⏸ PAUSE ALL', style: { fontFamily: 'monospace', fontSize: 9, fill: 0xff3366, fontWeight: 'bold' } });
  pauseBtn.position.set(LEFT_W-80, 16); sidebar.addChild(pauseBtn);
  pauseBtn.eventMode = 'static';
  pauseBtn.on('pointerdown', () => { paused = !paused; pauseBtn.text = paused ? '▶ RESUME ALL' : '⏸ PAUSE ALL'; pauseBtn.style.fill = paused ? 0x00ff66 : 0xff3366; });

  const logDivider = new Graphics(); logDivider.moveTo(4, 340).lineTo(LEFT_W-4, 340).stroke({ color: C.border, width: 1 }); sidebar.addChild(logDivider);
  const logTitle = new Text({ text: '▌ EVENT LOG', style: { fontFamily: 'monospace', fontSize: 10, fill: 0xffcc00, fontWeight: 'bold' } });
  logTitle.position.set(6, 348); sidebar.addChild(logTitle);
  const logText = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 8, fill: 0x00ff88, lineHeight: 12, wordWrap: true, wordWrapWidth: LEFT_W-12 } });
  logText.position.set(6, 368); sidebar.addChild(logText);

  // ===== MAP =====
  const world = new Container(); world.sortableChildren = true; world.position.set(LEFT_W+4, TOP_H+4); app.stage.addChild(world);
  const tilesetUrls = ['/tilesets/office-tileset.png', '/tilesets/a5-office-floors-walls.png', '/tilesets/interiors.png'];
  const tilesetTextures = await Promise.all(tilesetUrls.map(loadTexture));
  const mapData = JSON.parse(officeMapRaw);
  const mapRenderer = new TiledMapRenderer(mapData, tilesetTextures);
  world.addChild(mapRenderer.getContainer());
  const ts = mapRenderer.tileSize;
  const availMapW = MID_W - 8, availMapH = MID_H - 100;
  const mapScale = Math.min(availMapW / (mapRenderer.width*ts), availMapH / (mapRenderer.height*ts), 3);
  world.scale.set(mapScale);
  let currentScale = mapScale;
  // Mobile touch: pinch zoom + drag
  const touchState = { dragging: false, moved: false, startX: 0, startY: 0, lastDist: 0, startTime: 0 };
  app.canvas.addEventListener('touchstart', (e: TouchEvent) => {
    touchState.dragging = true;
    touchState.moved = false;
    touchState.startTime = Date.now();
    if (e.touches.length === 1) {
      touchState.startX = e.touches[0].clientX;
      touchState.startY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchState.lastDist = Math.sqrt(dx*dx + dy*dy);
    }
  });
  app.canvas.addEventListener('touchmove', (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length === 1 && touchState.dragging) {
      const dx = e.touches[0].clientX - touchState.startX;
      const dy = e.touches[0].clientY - touchState.startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) touchState.moved = true;
      world.x += dx;
      world.y += dy;
      touchState.startX = e.touches[0].clientX;
      touchState.startY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const delta = dist - touchState.lastDist;
      currentScale = Math.max(mapScale * 0.5, Math.min(mapScale * 2, currentScale + delta * 0.01));
      world.scale.set(currentScale);
      touchState.lastDist = dist;
      touchState.moved = true;
    }
  }, { passive: false });
  app.canvas.addEventListener('touchend', () => {
    touchState.dragging = false;
    touchState.moved = false;
  });
  const spawnPoints = mapRenderer.getAllSpawnPoints();
  const kitchenPos = { x: 27, y: 14 }, meetingPos = { x: 16, y: 5 };

  // ===== CHARACTERS =====
  const sprites: Sprite[] = [], bubbles: Container[] = [], names: Text[] = [], statusIcons: Text[] = [];
  const listItems: Container[] = [], progressBars: Graphics[] = [], tokenLabels: Text[] = [];

  for (let i = 0; i < EMPLOYEES.length; i++) {
    const emp = EMPLOYEES[i];
    const seat = spawnPoints.get(emp.spawn); if (!seat) continue;
    const frames = sceneFrameBufs(emp.cast);
    const tex = bufToTexture(frames.front[0]);
    const spr = new Sprite(tex);
    const s = (ts*1.8)/SCENE_H;
    spr.scale.set(s); spr.anchor.set(0.5, 1.0);
    spr.position.set(seat.x*ts+ts/2, seat.y*ts+ts); spr.zIndex = seat.y+1;
    world.addChild(spr); sprites.push(spr);
    emp.targetX = seat.x*ts+ts/2; emp.targetY = seat.y*ts+ts;
    const px = seat.x*ts+ts/2, py = seat.y*ts+ts;
    const bubble = makeBubble(STATE_THOUGHT[emp.state], emp.state);
    bubble.position.set(px, py - SCENE_H*s - 3); bubble.zIndex = 10000;
    world.addChild(bubble); bubbles.push(bubble);
    const icon = new Text({ text: '', style: { fontSize: 1 } });
    icon.anchor.set(0.5, 0.5); icon.position.set(px, py - SCENE_H*s - 14); icon.zIndex = 10001; icon.visible = false;
    world.addChild(icon); statusIcons.push(icon);
    const name = new Text({ text: emp.name, style: { fontFamily: 'monospace', fontSize: 6, fill: C.text, backgroundColor: 0x0a0a0a, padding: 1 } });
    name.anchor.set(0.5, 0); name.position.set(px, py+2); name.zIndex = 10000;
    world.addChild(name); names.push(name);

    const item = new Container(); item.position.set(4, 32 + i*42);
    const itemBg = new Graphics(); itemBg.rect(0, 0, LEFT_W-8, 38).fill({ color: C.panelBg2, alpha: 0.8 });
    itemBg.rect(0, 0, LEFT_W-8, 38).stroke({ color: STATE_COLOR[emp.state], alpha: 0.4, width: 1 });
    item.addChild(itemBg);
    const dot = new Graphics(); dot.circle(7, 8, 2.5).fill({ color: STATE_COLOR[emp.state] }); item.addChild(dot);
    const pTag = new Text({ text: emp.priority, style: { fontFamily: 'monospace', fontSize: 7, fill: emp.priority==='H'?0xff3366:emp.priority==='M'?0xffcc00:0x888888 } });
    pTag.position.set(14, 3); item.addChild(pTag);
    const itemName = new Text({ text: emp.name, style: { fontFamily: 'monospace', fontSize: 9, fill: 0xffffff, fontWeight: 'bold' } });
    itemName.position.set(24, 3); item.addChild(itemName);
    const itemTask = new Text({ text: emp.task, style: { fontFamily: 'monospace', fontSize: 7, fill: C.textDim } });
    itemTask.position.set(4, 15); item.addChild(itemTask);
    const barBg = new Graphics(); barBg.rect(4, 25, LEFT_W-16, 3).fill({ color: 0x222233 }); item.addChild(barBg);
    const barFill = new Graphics(); barFill.rect(4, 25, (LEFT_W-16)*emp.progress/100, 3).fill({ color: STATE_COLOR[emp.state] }); item.addChild(barFill);
    progressBars.push(barFill);
    const tokenLbl = new Text({ text: `◆${emp.tokens}`, style: { fontFamily: 'monospace', fontSize: 7, fill: C.text } });
    tokenLbl.position.set(LEFT_W-40, 3); item.addChild(tokenLbl);
    tokenLabels.push(tokenLbl);
    sidebar.addChild(item); listItems.push(item);
  }

  // ===== CENTER BOTTOM: TASK BOARD =====
  const taskBoard = new Container(); taskBoard.position.set(LEFT_W, TOP_H + availMapH + 10); app.stage.addChild(taskBoard);
  const tbBg = new Graphics(); sciPanel(tbBg, 0, 0, MID_W, 85, C.border); taskBoard.addChild(tbBg);
  const tbTitle = new Text({ text: '▌ TASK BOARD', style: { fontFamily: 'monospace', fontSize: 10, fill: C.text, fontWeight: 'bold' } });
  tbTitle.position.set(6, 4); taskBoard.addChild(tbTitle);
  const tbStats = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 9, fill: 0xffffff, lineHeight: 12 } });
  tbStats.position.set(6, 20); taskBoard.addChild(tbStats);
  const tbBar = new Graphics(); tbBar.rect(6, 40, MID_W-12, 6).fill({ color: 0x222233 }); taskBoard.addChild(tbBar);
  const tbBarFill = new Graphics(); taskBoard.addChild(tbBarFill);
  const tbGap = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 9, fill: 0xffcc00, fontWeight: 'bold' } });
  tbGap.position.set(6, 52); taskBoard.addChild(tbGap);

  // ===== RIGHT PANEL =====
  const rightPanel = new Container(); rightPanel.position.set(LEFT_W+MID_W, TOP_H); app.stage.addChild(rightPanel);
  const rpBg = new Graphics(); sciPanel(rpBg, 0, 0, RIGHT_W, MID_H, C.border); rightPanel.addChild(rpBg);
  const dashTitle = new Text({ text: '▌ MONITOR', style: { fontFamily: 'monospace', fontSize: 10, fill: C.accent, fontWeight: 'bold' } });
  dashTitle.position.set(6, 4); rightPanel.addChild(dashTitle);
  const dashStatusText = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 8, fill: 0xffffff, lineHeight: 10 } });
  dashStatusText.position.set(6, 20); rightPanel.addChild(dashStatusText);
  // Pie chart (small, top-right)
  const pieG = new Graphics(); pieG.position.set(RIGHT_W-50, 35); rightPanel.addChild(pieG);
  // Token trend line chart (taller)
  const tokenChartLabel = new Text({ text: 'TOKEN TREND', style: { fontFamily: 'monospace', fontSize: 7, fill: C.textDim } });
  tokenChartLabel.position.set(6, 100); rightPanel.addChild(tokenChartLabel);
  const tokenChartG = new Graphics(); tokenChartG.position.set(6, 109); rightPanel.addChild(tokenChartG);
  // Activity sparkline
  const sparkLabel = new Text({ text: 'ACTIVITY (30s)', style: { fontFamily: 'monospace', fontSize: 7, fill: C.textDim } });
  sparkLabel.position.set(6, 150); rightPanel.addChild(sparkLabel);
  const sparkG = new Graphics(); sparkG.position.set(6, 159); rightPanel.addChild(sparkG);
  // 7-day bar chart
  const barLabel = new Text({ text: '7D COMPLETION', style: { fontFamily: 'monospace', fontSize: 7, fill: C.textDim } });
  barLabel.position.set(6, 200); rightPanel.addChild(barLabel);
  const barG = new Graphics(); barG.position.set(6, 209); rightPanel.addChild(barG);
  // Token budget bar
  const budgetLabel = new Text({ text: 'TOKEN BUDGET', style: { fontFamily: 'monospace', fontSize: 7, fill: C.textDim } });
  budgetLabel.position.set(6, 225); rightPanel.addChild(budgetLabel);
  const budgetG = new Graphics(); budgetG.position.set(6, 234); rightPanel.addChild(budgetG);
  const budgetTxt = new Text({ text: '0 / 10000', style: { fontFamily: 'monospace', fontSize: 7, fill: C.text } });
  budgetTxt.position.set(120, 234); rightPanel.addChild(budgetTxt);
  const traceDiv = new Graphics(); traceDiv.moveTo(4, 255).lineTo(RIGHT_W-4, 255).stroke({ color: C.border, width: 1 }); rightPanel.addChild(traceDiv);
  const traceTitle = new Text({ text: '▌ TRACE', style: { fontFamily: 'monospace', fontSize: 10, fill: C.text, fontWeight: 'bold' } });
  traceTitle.position.set(6, 263); rightPanel.addChild(traceTitle);
  const traceInfo = new Text({ text: '[ dbl-click agent ]', style: { fontFamily: 'monospace', fontSize: 8, fill: C.textDim, wordWrap: true, wordWrapWidth: RIGHT_W-12, lineHeight: 12 } });
  traceInfo.position.set(6, 283); rightPanel.addChild(traceInfo);
  const histDiv = new Graphics(); histDiv.moveTo(4, 320).lineTo(RIGHT_W-4, 320).stroke({ color: 0xffcc00, width: 2 }); rightPanel.addChild(histDiv);
  const histTitle = new Text({ text: '▌ TASK HISTORY', style: { fontFamily: 'monospace', fontSize: 10, fill: 0xffcc00, fontWeight: 'bold' } });
  histTitle.position.set(6, 326); rightPanel.addChild(histTitle);
  const histText = new Text({ text: '✓ No completed tasks yet', style: { fontFamily: 'monospace', fontSize: 7, fill: 0x00ff88, wordWrap: true, wordWrapWidth: RIGHT_W-12, lineHeight: 10 } });
  histText.position.set(6, 342); rightPanel.addChild(histText);

  // ===== TIME REPLAY (fixed bottom) =====
  const replayDiv = new Graphics(); replayDiv.moveTo(4, 400).lineTo(RIGHT_W-4, 400).stroke({ color: 0xff00ff, width: 3 }); rightPanel.addChild(replayDiv);
  const replayTitle = new Text({ text: '▌ TIME REPLAY', style: { fontFamily: 'monospace', fontSize: 10, fill: 0xff00ff, fontWeight: 'bold' } });
  replayTitle.position.set(6, 408); rightPanel.addChild(replayTitle);
  const replayHint = new Text({ text: '← drag →', style: { fontFamily: 'monospace', fontSize: 7, fill: C.textDim } });
  replayHint.position.set(90, 410); rightPanel.addChild(replayHint);
  // Play/pause button + speed
  const playBtn = new Text({ text: '▶ PLAY', style: { fontFamily: 'monospace', fontSize: 9, fill: 0x00ff88, fontWeight: 'bold' } });
  playBtn.position.set(6, 428); rightPanel.addChild(playBtn);
  const speedTxt = new Text({ text: '1x', style: { fontFamily: 'monospace', fontSize: 9, fill: C.text } });
  speedTxt.position.set(60, 428); rightPanel.addChild(speedTxt);
  // Timeline bar
  const timelineBg = new Graphics(); timelineBg.rect(6, 448, RIGHT_W-16, 6).fill({ color: 0x1a1a33 }); rightPanel.addChild(timelineBg);
  const timelineFill = new Graphics(); timelineFill.rect(6, 448, 0, 6).fill({ color: 0xff00ff }); rightPanel.addChild(timelineFill);
  const timelineLabel = new Text({ text: '00:00', style: { fontFamily: 'monospace', fontSize: 8, fill: C.text } });
  timelineLabel.position.set(6, 458); rightPanel.addChild(timelineLabel);
  // Click on timeline to seek
  const replayState = { playing: false, speed: 1, index: 0, data: [] as any[] };
  let draggingTimeline = false;
  function seekTo(clientX: number) {
    if (replayState.data.length === 0) return;
    const rect = timelineBg.getBounds();
    const localX = clientX - rect.x;
    const pct = Math.max(0, Math.min(1, localX / (RIGHT_W-16)));
    replayState.index = pct * replayState.data.length;
    const snap = replayState.data[Math.floor(replayState.index)];
    if (snap && snap.agents) {
      snap.agents.forEach((a: any, i: number) => {
        if (i < EMPLOYEES.length && !pausedAgents.has(i)) {
          EMPLOYEES[i].state = a.state as AgentState;
          EMPLOYEES[i].task = a.task;
          EMPLOYEES[i].progress = a.progress;
          EMPLOYEES[i].tokens = a.tokens;
        }
      });
    }
  }
  timelineBg.eventMode = 'static'; timelineBg.cursor = 'pointer';
  timelineBg.hitArea = { contains: (x: number, y: number) => x >= 0 && x <= RIGHT_W-16 && y >= -4 && y <= 10 };
  timelineBg.on('pointerdown', (e) => { draggingTimeline = true; replayState.playing = false; playBtn.text = '▶ PLAY'; seekTo(e.global.x); });
  timelineBg.on('pointermove', (e) => { if (draggingTimeline) seekTo(e.global.x); });
  timelineBg.on('pointerup', () => { draggingTimeline = false; replayState.playing = true; playBtn.text = '⏸ PAUSE'; });
  timelineBg.on('pointerupoutside', () => { draggingTimeline = false; });
  playBtn.eventMode = 'static'; playBtn.cursor = 'pointer';
  playBtn.on('pointertap', () => {
    replayState.playing = !replayState.playing;
    playBtn.text = replayState.playing ? '⏸ PAUSE' : '▶ PLAY';
    playBtn.style.fill = replayState.playing ? 0xffcc00 : 0x00ff88;
  });
  speedTxt.eventMode = 'static'; speedTxt.cursor = 'pointer';
  speedTxt.on('pointertap', () => {
    replayState.speed = replayState.speed === 1 ? 2 : replayState.speed === 2 ? 4 : 1;
    speedTxt.text = `${replayState.speed}x`;
  });

  // ===== BOTTOM TERMINAL =====
  const bottomBar = new Container(); bottomBar.position.set(0, H-BOT_H); app.stage.addChild(bottomBar);
  const bbBg = new Graphics(); sciPanel(bbBg, 0, 0, W, BOT_H, C.text); bottomBar.addChild(bbBg);
  const termTitle = new Text({ text: '▌ TERMINAL', style: { fontFamily: 'monospace', fontSize: 9, fill: C.text, fontWeight: 'bold' } });
  termTitle.position.set(6, 3); bottomBar.addChild(termTitle);
  const clearBtn = new Text({ text: '✕ clear', style: { fontFamily: 'monospace', fontSize: 8, fill: 0xff3366 } });
  clearBtn.position.set(W-60, 3); bottomBar.addChild(clearBtn);
  const termText = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 9, fill: 0x00ff41, lineHeight: 14, wordWrap: true, wordWrapWidth: W-12 } });
  termText.position.set(6, 42); bottomBar.addChild(termText);
  // Token TOP3 + Adapters (top row of bottom bar)
  const bottomStatsText = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 8, fill: 0x00ffff, lineHeight: 12 } });
  bottomStatsText.position.set(100, 4); bottomBar.addChild(bottomStatsText);
  const bottomAdapterText = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 8, fill: 0x00ff88, lineHeight: 12 } });
  bottomAdapterText.position.set(W - 350, 4); bottomBar.addChild(bottomAdapterText);
  const termLines: string[] = [];
  clearBtn.eventMode = 'static';
  clearBtn.on('pointerdown', () => { termLines.length = 0; termText.text = ''; });

  function addEvent(text: string, color: number = 0x00ff88) {
    eventLog.push({ time: now(), text, color });
    if (eventLog.length > 12) eventLog.shift();
    logText.text = eventLog.map(e => `[${e.time}] ${e.text}`).join('\n');
  }
  function addTerm(text: string) {
    termLines.push(text);
    if (termLines.length > 3) termLines.shift();
    termText.text = termLines.join('\n');
  }
  function addTaskHistory(name: string, agent: string, tokens: number, ok: boolean) {
    taskHistory.unshift({ name, agent, time: now(), tokens, ok });
    if (taskHistory.length > 4) taskHistory.pop();
    histText.text = taskHistory.map((t,i) => `${i===0 ? '🆕 ' : (t.ok?'✅':'❌')} ${t.name} (${agent})`).join('\n');
    setTimeout(() => {
      histText.text = taskHistory.map(t => `${t.ok?'✅':'❌'} ${t.name} (${agent})`).join('\n');
    }, 3000);
  }

  // ===== DOUBLE-CLICK =====
  let lastClickTime = 0, lastClickIdx = -1;
  world.eventMode = 'static';
  world.on('pointerdown', (e) => {
    const pos = e.global;
    let closest = -1, minDist = 30 / currentScale;
    EMPLOYEES.forEach((emp, i) => {
      const dx = (pos.x-world.x)/currentScale - sprites[i].x;
      const dy = (pos.y-world.y)/currentScale - sprites[i].y;
      const d = Math.sqrt(dx*dx+dy*dy);
      if (d < minDist) { minDist = d; closest = i; }
    });
    if (closest >= 0) {
      const t = Date.now();
      if (closest === lastClickIdx && t - lastClickTime < 300) {
        const emp = EMPLOYEES[closest];
        let txt = `┌─ ${emp.name} (${emp.role})\n`;
        txt += `├─ Status: ${STATE_LABEL[emp.state]}\n`;
        txt += `├─ Progress: ${Math.round(emp.progress)}%\n`;
        txt += `├─ Tokens: ${emp.tokens}\n`;
        txt += `├─ Task: ${emp.task}\n`;
        txt += `└─ Call stack (click to expand):\n`;
        emp.trace.slice(-3).forEach((step, i) => {
          const isErr = step.action.includes('error') || step.action.includes('fail');
          txt += `   ${isErr?'🔴':'▶'} [${step.time}] ${step.action}\n`;
          txt += `   │   ⏱ ${(Math.random()*200).toFixed(0)}ms  📥 input  📤 output\n`;
        });
        traceInfo.text = txt;
        traceInfo.style.fill = emp.state === 'error' ? 0xff3366 : C.text;
      }
      lastClickTime = t; lastClickIdx = closest;
    }
  });

  // ===== STATE MACHINE =====
  const DUR: Record<string, number> = { writing: 5000, thinking: 4000, calling_tool: 4000, error: 3500, dead_loop: 6000, success: 2500, idle: 3000 };

  function updateStats() {
    const total = EMPLOYEES.length;
    const active = EMPLOYEES.filter(e => e.state === 'writing' || e.state === 'thinking').length;
    const errors = EMPLOYEES.filter(e => e.state === 'error').length;
    const deadLoops = EMPLOYEES.filter(e => e.state === 'dead_loop').length;
    const done = EMPLOYEES.filter(e => e.state === 'success').length;
    const totalTokens = EMPLOYEES.reduce((s, e) => s + e.tokens, 0);
    statsText.text = `A:${active} E:${errors} DL:${deadLoops} D:${done} ◆${totalTokens}`;

    let txt = '';
    for (const s of ['writing','thinking','calling_tool','error','dead_loop','success','idle']) {
      const count = EMPLOYEES.filter(e => e.state === s).length;
      txt += `${STATE_LABEL[s].padEnd(13)} ${'█'.repeat(count)}${count}\n`;
    }
    dashStatusText.text = txt;
    pieG.clear();
    const states = ['writing','thinking','calling_tool','error','dead_loop','success','idle'];
    let startAngle = -Math.PI/2;
    states.forEach(s => {
      const count = EMPLOYEES.filter(e => e.state === s).length;
      if (count > 0) {
        const angle = (count / EMPLOYEES.length) * Math.PI * 2;
        pieG.moveTo(0, 0).arc(0, 0, 20, startAngle, startAngle + angle).fill({ color: STATE_COLOR[s] });
        startAngle += angle;
      }
    });
    pieG.circle(0, 0, 10).fill({ color: C.panelBg });

    // Token rank (top 3) -> bottom bar
    const sortedAgents = EMPLOYEES.slice().sort((a, b) => b.tokens - a.tokens);
    const top3 = sortedAgents.slice(0, 3).map((a, i) => `${i+1}.${a.name} ${a.tokens}`).join('  ');
    bottomStatsText.text = `◆ TOKEN TOP3: ${top3}`;
    bottomAdapterText.text = 'CrewAI:  ●  ONLINE        OTel:  ●  ONLINE        Langfuse:  ●  SYNC';

    // Token trend line chart
    tokenChartG.clear();
    const chartW = RIGHT_W - 16, chartH = 30;
    tokenChartG.rect(0, 0, chartW, chartH).fill({ color: 0x0a0a14 });
    tokenChartG.rect(0, 0, chartW, chartH).stroke({ color: C.border, alpha: 0.3, width: 1 });
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < 20; i++) {
      pts.push({ x: (chartW / 19) * i, y: chartH - 4 - Math.abs(Math.sin(i * 0.5) * chartH * 0.6 + Math.random() * 4) });
    }
    tokenChartG.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) tokenChartG.lineTo(pts[i].x, pts[i].y);
    tokenChartG.stroke({ color: 0x00d4ff, width: 1.5 });

    // Activity sparkline
    sparkG.clear();
    const sw = RIGHT_W - 16, sh = 30;
    sparkG.rect(0, 0, sw, sh).fill({ color: 0x0a0a14 });
    sparkG.rect(0, 0, sw, sh).stroke({ color: C.border, alpha: 0.3, width: 1 });
    const spts: { x: number; y: number }[] = [];
    for (let i = 0; i < 15; i++) {
      spts.push({ x: (sw / 14) * i, y: sh - 4 - Math.abs(Math.sin(i * 0.7) * sh * 0.6 + Math.random() * 4) });
    }
    sparkG.moveTo(spts[0].x, spts[0].y);
    for (let i = 1; i < spts.length; i++) sparkG.lineTo(spts[i].x, spts[i].y);
    sparkG.stroke({ color: 0xff00ff, width: 1.5 });

    // 7-day bar chart
    barG.clear();
    const bw = RIGHT_W - 16, bh = 30;
    barG.rect(0, 0, bw, bh).fill({ color: 0x0a0a14 });
    barG.rect(0, 0, bw, bh).stroke({ color: C.border, alpha: 0.3, width: 1 });
    const dailyData = [2, 4, 3, 5, 4, 6, 3];
    const barW = (bw - 20) / 7;
    dailyData.forEach((v, i) => {
      const h = v * 4;
      barG.rect(10 + i * barW + 2, bh - 4 - h, barW - 4, h).fill({ color: 0x00ff66, alpha: 0.7 });
      barG.rect(10 + i * barW + 2, bh - 4 - h, barW - 4, 2).fill({ color: 0x00ff66 });
    });

    // Token budget bar
    budgetG.clear();
    const totalTok = EMPLOYEES.reduce((s, e) => s + e.tokens, 0);
    const budget = 10000;
    const budPct = Math.min(1, totalTok / budget);
    const budgetColor = budPct > 0.9 ? 0xff3366 : budPct > 0.7 ? 0xffcc00 : 0x00ff88;
    budgetG.rect(0, 0, RIGHT_W - 16, 6).fill({ color: 0x0a0a14 });
    budgetG.rect(0, 0, (RIGHT_W - 16) * budPct, 6).fill({ color: budgetColor });
    budgetTxt.text = `${totalTok} / ${budget}`;
    budgetTxt.style.fill = budgetColor;

    const totalTasks = 12;
    const doneTasks = taskHistory.length;
    const inProg = active;
    const pct = Math.round((doneTasks / totalTasks) * 100);
    tbStats.text = `Total:${totalTasks} Done:${doneTasks} InProgress:${inProg} Pending:${totalTasks-doneTasks-inProg}`;
    tbBarFill.clear();
    tbBarFill.rect(6, 40, (MID_W-12) * doneTasks / totalTasks, 6).fill({ color: 0x00ff66 });
    tbGap.text = `🎯 Gap: ${totalTasks - doneTasks} tasks to goal (${pct}% complete)`;
  }

  function setState(idx: number, s: AgentState) {
    if (paused) return;
    const emp = EMPLOYEES[idx];
    emp.state = s;
    const costs: Record<string, number> = { writing: 50, thinking: 100, calling_tool: 300, error: 20, dead_loop: 500, success: 10, idle: 0 };
    emp.tokens += costs[s] || 0;
    emp.trace.push({ time: now(), action: `${STATE_LABEL[s]} +${costs[s]||0}` });
    if (emp.trace.length > 20) emp.trace.shift();
    if (s === 'writing') addEvent(`${emp.name} started: ${emp.task}`, 0x00ffff);
    if (s === 'error') addEvent(`${emp.name} ERROR!`, 0xff3366);
    if (s === 'success') { addEvent(`${emp.name} done! +${emp.tokens}tok`, 0x00ff66); addTaskHistory(emp.task, emp.name, emp.tokens, true); }
    if (s === 'dead_loop') addEvent(`${emp.name} DEAD LOOP!`, 0xffcc00);
    addTerm(`> ${emp.name} -> ${STATE_LABEL[s]}`);
    const seat = spawnPoints.get(emp.spawn)!;
    const px = seat.x*ts+ts/2, py = seat.y*ts+ts;
    world.removeChild(bubbles[idx]);
    const nb = makeBubble(STATE_THOUGHT[s], s);
    nb.position.set(px, py - SCENE_H*sprites[idx].scale.y - 3); nb.zIndex = 10000;
    world.addChild(nb); bubbles[idx] = nb;
    statusIcons[idx].text = STATE_ICON[s];
    updateStats();
    const itemBg = listItems[idx].children[0] as Graphics;
    itemBg.clear();
    itemBg.rect(0, 0, LEFT_W-8, 38).fill({ color: C.panelBg2, alpha: 0.8 });
    itemBg.rect(0, 0, LEFT_W-8, 38).stroke({ color: STATE_COLOR[s], alpha: 0.4, width: 1 });
  }

  function walkTo(idx: number, tx: number, ty: number) {
    const emp = EMPLOYEES[idx];
    // BFS pathfinding
    const startTile = mapRenderer.pixelToTile(emp.targetX - ts/2, emp.targetY - ts/2);
    const sx = startTile.x, sy = startTile.y;
    // Ensure target is walkable, find nearest walkable tile
    let ex = tx, ey = ty;
    if (!mapRenderer.isWalkable(ex, ey)) {
      // Search nearby for walkable
      outer: for (let r = 1; r < 5; r++) {
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (mapRenderer.isWalkable(tx+dx, ty+dy)) { ex = tx+dx; ey = ty+dy; break outer; }
        }
      }
    }
    // BFS
    const W = mapRenderer.width, H = mapRenderer.height;
    const visited: boolean[][] = Array.from({length: H}, () => Array(W).fill(false));
    const parent: ( {x:number;y:number} | null )[][] = Array.from({length: H}, () => Array(W).fill(null));
    const queue: {x:number;y:number}[] = [{x: sx, y: sy}];
    visited[sy][sx] = true;
    const dirs = [{x:0,y:1},{x:0,y:-1},{x:1,y:0},{x:-1,y:0}];
    let found = false;
    while (queue.length > 0 && !found) {
      const cur = queue.shift()!;
      if (cur.x === ex && cur.y === ey) { found = true; break; }
      for (const d of dirs) {
        const nx = cur.x+d.x, ny = cur.y+d.y;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (visited[ny][nx]) continue;
        if (!mapRenderer.isWalkable(nx, ny)) continue;
        visited[ny][nx] = true;
        parent[ny][nx] = cur;
        queue.push({x: nx, y: ny});
      }
    }
    // Reconstruct path
    const path: {x:number;y:number}[] = [];
    if (found) {
      let cx = ex, cy = ey;
      while (cx !== sx || cy !== sy) {
        path.unshift({x: cx, y: cy});
        const p = parent[cy][cx];
        if (!p) break;
        cx = p.x; cy = p.y;
      }
    }
    emp.path = path;
    emp.pathIdx = 0;
    if (path.length > 0) {
      const next = path[0];
      emp.targetX = next.x*ts+ts/2;
      emp.targetY = next.y*ts+ts;
      emp.walking = true;
    } else {
      // No path found, go direct
      emp.targetX = tx*ts+ts/2; emp.targetY = ty*ts+ts; emp.walking = true;
    }
  }
  function returnToDesk(idx: number) {
    const seat = spawnPoints.get(EMPLOYEES[idx].spawn)!;
    walkTo(idx, seat.x, seat.y);
  }

  function runWorkflow(idx: number) {
    setState(idx, 'writing');
    setTimeout(() => {
      setState(idx, 'thinking');
      setTimeout(() => {
        if (Math.random() < 0.7) {
          setState(idx, 'calling_tool'); walkTo(idx, kitchenPos.x, kitchenPos.y);
          setTimeout(() => {
            returnToDesk(idx);
            EMPLOYEES[idx].progress = Math.min(100, EMPLOYEES[idx].progress + 20);
            setState(idx, 'success');
            setTimeout(() => {
              if (EMPLOYEES[idx].progress >= 100) {
                EMPLOYEES[idx].progress = 0;
                EMPLOYEES[idx].task = TASK_POOL[Math.floor(Math.random()*TASK_POOL.length)];
                EMPLOYEES[idx].trace = [{ time: now(), action: `New: ${EMPLOYEES[idx].task}` }];
              }
              setState(idx, 'idle');
              setTimeout(() => runWorkflow(idx), 2000);
            }, DUR.success);
          }, DUR.calling_tool + 2000);
        } else {
          setState(idx, 'error'); walkTo(idx, meetingPos.x, meetingPos.y);
          setTimeout(() => {
            returnToDesk(idx);
            if (Math.random() < 0.5) {
              setState(idx, 'dead_loop');
              setTimeout(() => { setState(idx, 'thinking'); setTimeout(() => runWorkflow(idx), DUR.dead_loop); }, DUR.dead_loop);
            } else {
              setState(idx, 'thinking');
              setTimeout(() => runWorkflow(idx), DUR.error + 2000);
            }
          }, DUR.error + 2000);
        }
      }, DUR.thinking);
    }, DUR.writing);
  }
  EMPLOYEES.forEach((_, i) => setTimeout(() => runWorkflow(i), i*2000));
  updateStats();

  function startPairCollab(a: number, b: number) {
    walkTo(a, 10, 10); walkTo(b, 11, 10);
    setTimeout(() => {
      bubbles[a].children[1].text = '"帮我看下"';
      bubbles[b].children[1].text = '"我来review"';
      addEvent(`${EMPLOYEES[a].name} <-> ${EMPLOYEES[b].name}`, 0xff00ff);
      setTimeout(() => { returnToDesk(a); returnToDesk(b); setState(a, 'writing'); setState(b, 'writing'); }, 4000);
    }, 2500);
  }
  setTimeout(() => startPairCollab(0, 1), 8000);
  setInterval(() => {
    if (Math.random() < 0.6) {
      const a = Math.floor(Math.random()*8);
      let b = Math.floor(Math.random()*8);
      while (b === a) b = Math.floor(Math.random()*8);
      startPairCollab(a, b);
    }
  }, 20000);

  // ===== WEBSOCKET CONNECTION =====
  let wsConnected = false;
  try {
    const ws = new WebSocket('ws://' + (location.hostname || 'localhost') + ':5175');
    ws.onopen = () => {
      wsConnected = true;
      console.log('[WS] Connected to control room server');
    };
    ws.onclose = () => {
      wsConnected = false;
      console.log('[WS] Disconnected, using local simulation');
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'state' || msg.type === 'init') {
          // Update agents from server
          if (msg.agents && msg.agents.length > 0) {
            msg.agents.forEach((a: any, i: number) => {
              if (i < EMPLOYEES.length && !pausedAgents.has(i)) {
                const oldState = EMPLOYEES[i].state;
                EMPLOYEES[i].state = a.state as AgentState;
                EMPLOYEES[i].task = a.task;
                EMPLOYEES[i].progress = a.progress;
                EMPLOYEES[i].tokens = a.tokens;
                // Trigger walking on state change
                if (a.state === 'calling_tool' && oldState !== 'calling_tool') {
                  walkTo(i, kitchenPos.x, kitchenPos.y);
                }
                if (a.state === 'error' && oldState !== 'error') {
                  walkTo(i, meetingPos.x, meetingPos.y);
                }
                if ((a.state === 'success' || a.state === 'idle' || a.state === 'writing') &&
                    oldState === 'calling_tool' || oldState === 'error') {
                  returnToDesk(i);
                }
                // Update bubble
                if (bubbles[i]) {
                  world.removeChild(bubbles[i]);
                  const nb = makeBubble(STATE_THOUGHT[a.state as AgentState] || '...', a.state);
                  nb.position.set(sprites[i].x, sprites[i].y - SCENE_H*sprites[i].scale.y - 5);
                  world.addChild(nb); bubbles[i] = nb;
                }
              }
            });
          }
          if (msg.adapters) {
            (window as any).__adapters = msg.adapters;
          }
        }
        if (msg.type === 'history') {
          replayState.data = msg.history || [];
          console.log(`[WS] Received ${replayState.data.length} history snapshots`);
        }
      } catch (e) { /* ignore */ }
    };
    // Request history after connection
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'get_history' }));
      }
    }, 1000);
  } catch (e) {
    console.log('[WS] Connection failed, using local simulation');
  }

  // ===== BIG SCREEN MODE (F11 / ESC) =====
  let bigScreen = false;
  let mobileMode = app.screen.width < 768;
  let drawerOpen = ''; // '', 'agents', 'monitor'
  let drawerAnim = 0; // 0 = closed, 1 = open
  let drawerTarget = 0;
  let drawerOverlay: Graphics | null = null;
  const sidePanels = [sidebar, rightPanel, taskBoard, topBar, bottomBar];

  // Mobile drawer buttons
  const drawerBar = new Graphics();
  drawerBar.rect(0, app.screen.height - 40, app.screen.width, 40).fill({ color: 0x111122, alpha: 0.9 }).stroke({ color: 0xff00ff, width: 1 });
  app.stage.addChild(drawerBar);
  const btnAgents = new Text({ text: '👥 员工列表', style: { fontFamily: 'monospace', fontSize: 11, fill: 0x80f0ff } });
  btnAgents.position.set(20, app.screen.height - 28); app.stage.addChild(btnAgents);
  const btnMonitor = new Text({ text: '📊 监控面板', style: { fontFamily: 'monospace', fontSize: 11, fill: 0xff00ff } });
  btnMonitor.position.set(app.screen.width/2 + 20, app.screen.height - 28); app.stage.addChild(btnMonitor);
  btnAgents.eventMode = 'static'; btnAgents.cursor = 'pointer';
  btnMonitor.eventMode = 'static'; btnMonitor.cursor = 'pointer';
  btnAgents.on('pointertap', () => { drawerOpen = drawerOpen === 'agents' ? '' : 'agents'; drawerTarget = drawerOpen ? 1 : 0; });
  btnMonitor.on('pointertap', () => { drawerOpen = drawerOpen === 'monitor' ? '' : 'monitor'; drawerTarget = drawerOpen ? 1 : 0; });

  function addOverlay() {
    if (drawerOverlay) app.stage.removeChild(drawerOverlay);
    drawerOverlay = new Graphics();
    drawerOverlay.rect(0, 0, app.screen.width, app.screen.height - 40).fill({ color: 0x000000, alpha: 0.5 });
    drawerOverlay.eventMode = 'static';
    drawerOverlay.on('pointertap', () => { drawerOpen = ''; drawerTarget = 0; });
    app.stage.addChild(drawerOverlay);
  }

  function updateDrawer() {
    if (mobileMode) {
      drawerBar.visible = true; btnAgents.visible = true; btnMonitor.visible = true;
      topBar.visible = false; taskBoard.visible = false; bottomBar.visible = false;
      sidebar.visible = true; rightPanel.visible = true;
      const slideY = (1 - drawerAnim) * (app.screen.height - 80);
      sidebar.position.set(0, 40 + slideY);
      rightPanel.position.set(app.screen.width - RIGHT_W, 40 + slideY);
      sidebar.alpha = drawerAnim;
      rightPanel.alpha = drawerAnim;
      if (drawerOverlay) { drawerOverlay.alpha = drawerAnim * 0.5; }
    } else {
      drawerBar.visible = false; btnAgents.visible = false; btnMonitor.visible = false;
      if (drawerOverlay) { app.stage.removeChild(drawerOverlay); drawerOverlay = null; }
      const showPanels = !bigScreen;
      sidePanels.forEach(p => { p.visible = showPanels; p.alpha = 1; });
      sidebar.position.set(0, 48);
      rightPanel.position.set(app.screen.width - RIGHT_W, 48);
    }
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'F11' || e.key === 'f11') {
      e.preventDefault();
      bigScreen = !bigScreen;
      updateDrawer();
    }
    if (e.key === 'Escape' && bigScreen) {
      bigScreen = false;
      updateDrawer();
    }
  });
  window.addEventListener('resize', () => {
    mobileMode = app.screen.width < 768;
    updateDrawer();
  });
  updateDrawer();

  // ===== USER AVATAR (click map to move) =====
  const userAvatar = new Graphics();
  userAvatar.circle(0, 0, 5).fill({ color: 0xffff00 }).stroke({ color: 0xffffff, width: 1.5 });
  userAvatar.position.set(LEFT_W + MID_W/2, TOP_H + MID_H/2);
  userAvatar.zIndex = 9999;
  app.stage.addChild(userAvatar);
  let userTarget = { x: userAvatar.x, y: userAvatar.y };
  let selectedAgent = -1;
  let meetingStart = 0;
  const pausedAgents = new Set<number>();

  // Click on map to move user avatar
  world.eventMode = 'static';
  world.cursor = 'crosshair';
  world.on('pointertap', (e) => {
    if (bigScreen) return;
    const pos = world.toLocal(e.global);
    userTarget.x = pos.x;
    userTarget.y = pos.y;
  });

  // Popup menu when user near an agent
  const popupMenu = new Container(); popupMenu.visible = false; popupMenu.alpha = 0; popupMenu.scale.set(0.8);
  const popupBg = new Graphics(); popupBg.roundRect(0, 0, 90, 64, 4).fill({ color: 0x111122, alpha: 0.95 }).stroke({ color: 0xff00ff, width: 1 });
  popupMenu.addChild(popupBg);
  const popupBtn1 = new Text({ text: '⏸ Pause', style: { fontFamily: 'monospace', fontSize: 8, fill: 0xffcc00 } });
  popupBtn1.position.set(6, 6); popupMenu.addChild(popupBtn1);
  const popupBtn2 = new Text({ text: '▶ Resume', style: { fontFamily: 'monospace', fontSize: 8, fill: 0x00ff88 } });
  popupBtn2.position.set(6, 24); popupMenu.addChild(popupBtn2);
  const popupBtn3 = new Text({ text: '✓ Approve', style: { fontFamily: 'monospace', fontSize: 8, fill: 0x00d4ff } });
  popupBtn3.position.set(6, 42); popupMenu.addChild(popupBtn3);
  popupBtn1.eventMode = 'static'; popupBtn1.cursor = 'pointer';
  popupBtn2.eventMode = 'static'; popupBtn2.cursor = 'pointer';
  popupBtn3.eventMode = 'static'; popupBtn3.cursor = 'pointer';
  popupBtn1.on('pointertap', () => {
    if (selectedAgent >= 0) { pausedAgents.add(selectedAgent); popupBtn1.style.fill = 0x666666; }
  });
  popupBtn2.on('pointertap', () => {
    if (selectedAgent >= 0) { pausedAgents.delete(selectedAgent); popupBtn1.style.fill = 0xffcc00; }
  });
  popupBtn3.on('pointertap', () => {
    if (selectedAgent >= 0) {
      EMPLOYEES[selectedAgent].progress = 100;
      EMPLOYEES[selectedAgent].state = 'success';
    }
  });
  app.stage.addChild(popupMenu);

  // ===== TASK DEPENDENCY VISUALIZATION =====
  const depLayer = new Graphics();
  depLayer.zIndex = 50;
  world.addChild(depLayer);
  // Auto-generate dependency chains: group by task type
  function buildDeps(): number[][] {
    const frontend: number[] = [], backend: number[] = [], test: number[] = [];
    EMPLOYEES.forEach((e, i) => {
      if (/ui|css|page|login|前端|组件/i.test(e.task)) frontend.push(i);
      else if (/api|db|接口|deploy|后端/i.test(e.task)) backend.push(i);
      else test.push(i);
    });
    const chains: number[][] = [];
    if (backend.length > 0) chains.push(backend);
    if (frontend.length > 0) chains.push(frontend);
    if (test.length > 0) chains.push(test);
    return chains.length > 0 ? chains : [[0, 1, 2], [3, 4, 5]];
  }
  let depChains: number[][] = buildDeps();

  // ===== ANIMATION =====
  app.ticker.add((ticker) => {
    const dt = ticker.deltaTime / 60;

    // Replay logic
    if (replayState.playing && replayState.data.length > 0) {
      replayState.index += replayState.speed * 0.5;
      if (replayState.index >= replayState.data.length) replayState.index = 0;
      const snap = replayState.data[Math.floor(replayState.index)];
      if (snap && snap.agents) {
        snap.agents.forEach((a: any, i: number) => {
          if (i < EMPLOYEES.length) {
            EMPLOYEES[i].state = a.state as AgentState;
            EMPLOYEES[i].task = a.task;
            EMPLOYEES[i].progress = a.progress;
            EMPLOYEES[i].tokens = a.tokens;
          }
        });
      }
      // Update timeline
      const pct = replayState.data.length > 0 ? replayState.index / replayState.data.length : 0;
      timelineFill.clear();
      timelineFill.rect(6, 488, (RIGHT_W-16) * pct, 6).fill({ color: 0xff00ff });
      const elapsed = Math.floor(replayState.index * 5); // 5s per snapshot
      timelineLabel.text = `${Math.floor(elapsed/60)}:${String(elapsed%60).padStart(2,'0')}`;
    }

    // Drawer animation
    if (drawerAnim !== drawerTarget) {
      drawerAnim += (drawerTarget - drawerAnim) * 0.15;
      if (Math.abs(drawerAnim - drawerTarget) < 0.02) drawerAnim = drawerTarget;
      updateDrawer();
    }

    // User avatar movement
    const udx = userTarget.x - userAvatar.x, udy = userTarget.y - userAvatar.y;
    const udist = Math.sqrt(udx*udx + udy*udy);
    if (udist > 2) {
      userAvatar.x += (udx/udist) * 2;
      userAvatar.y += (udy/udist) * 2;
    } else {
      // Check if near any agent, show popup
      let nearAgent = -1;
      for (let i = 0; i < sprites.length; i++) {
        const sdx = sprites[i].x - userAvatar.x, sdy = sprites[i].y - userAvatar.y;
        if (Math.sqrt(sdx*sdx + sdy*sdy) < 30) nearAgent = i;
      }
      if (nearAgent >= 0) {
        selectedAgent = nearAgent;
        popupMenu.visible = true;
        // Smart edge avoidance
        let px = userAvatar.x + 10, py = userAvatar.y - 30;
        if (px + 90 > app.screen.width - 5) px = userAvatar.x - 100;
        if (px < 5) px = userAvatar.x + 10;
        if (py < 5) py = userAvatar.y + 15;
        if (py + 64 > app.screen.height - 5) py = userAvatar.y - 80;
        popupMenu.position.set(px, py);
        popupMenu.alpha = Math.min(1, popupMenu.alpha + 0.15);
        const s = Math.min(1, popupMenu.scale.x + 0.03);
        popupMenu.scale.set(s);
      } else {
        selectedAgent = -1;
        popupMenu.alpha = Math.max(0, popupMenu.alpha - 0.15);
        const s = Math.max(0.8, popupMenu.scale.x - 0.03);
        popupMenu.scale.set(s);
        if (popupMenu.alpha <= 0) popupMenu.visible = false;
      }
    }

    // Draw dependency lines with dynamic color
    depLayer.clear();
    depChains.forEach(chain => {
      for (let j = 0; j < chain.length - 1; j++) {
        const a = sprites[chain[j]], b = sprites[chain[j+1]];
        if (!a || !b) continue;
        const aDone = EMPLOYEES[chain[j]].state === 'success';
        const color = aDone ? 0x666688 : 0xb44dff;
        const alpha = aDone ? 0.3 : 0.8;
        depLayer.moveTo(a.x, a.y - 10).lineTo(b.x, b.y - 10);
        depLayer.stroke({ color, width: 1.5, alpha });
        depLayer.moveTo(a.x, a.y - 10).lineTo(b.x, b.y - 10);
        depLayer.stroke({ color, width: 3, alpha: alpha * 0.2 });
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        depLayer.moveTo(b.x - Math.cos(ang)*6, b.y - 10 - Math.sin(ang)*6);
        depLayer.lineTo(b.x - Math.cos(ang+0.5)*6, b.y - 10 - Math.sin(ang+0.5)*6);
        depLayer.stroke({ color, width: 1.5, alpha });
      }
    });

    // ===== GROUP CHAT: state + task-type aware =====
    const CHAT_BY_STATE: Record<string, string[]> = {
      writing: ['快写完了', '调接口中', 'UI搞定了', '查文档'],
      thinking: ['有点绕', '想想方案', '需求变了', '捋思路'],
      calling_tool: ['调API去', '查个资料', '调工具试试', '去茶水间'],
      error: ['报错了！', '这bug真坑', '谁来debug', '接口500'],
      success: ['搞定了！', '测试通过', '提交PR', '收工！'],
      idle: ['等任务', '摸鱼中', '喝杯咖啡', '好闲'],
      dead_loop: ['又转起来了', '死循环了', '停不下来']
    };
    function detectTaskType(task: string): string {
      if (/ui|css|组件|样式|页面|前端|login|page/i.test(task)) return 'frontend';
      if (/api|db|接口|后端|database|deploy|backend/i.test(task)) return 'backend';
      if (/test|测试|bug|用例|coverage/i.test(task)) return 'test';
      if (/prd|需求|排期|product|review/i.test(task)) return 'product';
      return 'general';
    }
    for (let i = 0; i < sprites.length; i++) {
      for (let j = i+1; j < sprites.length; j++) {
        const dx = sprites[i].x - sprites[j].x, dy = sprites[i].y - sprites[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 40 && dist > 5) {
          const stateI = EMPLOYEES[i].state;
          const stateJ = EMPLOYEES[j].state;
          const linesI = CHAT_BY_STATE[stateI] || CHAT_BY_STATE.idle;
          const linesJ = CHAT_BY_STATE[stateJ] || CHAT_BY_STATE.idle;
          const chatI = linesI[Math.floor(Date.now() / 4000) % linesI.length];
          const chatJ = linesJ[Math.floor(Date.now() / 4000 + 2) % linesJ.length];
          if (bubbles[i] && !bubbles[i].children.some(c => c.text === chatI)) {
            const chatTxt = new Text({ text: chatI.length > 16 ? chatI.slice(0, 14)+'...' : chatI, style: { fontFamily: 'monospace', fontSize: 7, fill: 0xffffff, wordWrap: true, wordWrapWidth: 80, lineHeight: 9 } });
            chatTxt.position.set(0, -15);
            bubbles[i].addChild(chatTxt);
          }
          if (bubbles[j] && !bubbles[j].children.some(c => c.text === chatJ)) {
            const chatTxt = new Text({ text: chatJ.length > 16 ? chatJ.slice(0, 14)+'...' : chatJ, style: { fontFamily: 'monospace', fontSize: 7, fill: 0xffffff, wordWrap: true, wordWrapWidth: 80, lineHeight: 9 } });
            chatTxt.position.set(0, -15);
            bubbles[j].addChild(chatTxt);
          }
        }
      }
    }

    // ===== MEETING: initiator → notify → attend → meet → dismiss =====
    let meetingStart = 0;
    const meetingAgents: number[] = [];
    for (let i = 0; i < sprites.length; i++) {
      const tileX = sprites[i].x / 16, tileY = sprites[i].y / 16;
      if (tileX > 14 && tileX < 22 && tileY > 3 && tileY < 10) {
        meetingAgents.push(i);
      }
    }
    // Initiator (Alice, i=0) walks to meeting room every 30s
    if (Math.floor(Date.now() / 30000) % 2 === 0 && !meetingStart) {
      // Alice heads to meeting room
      sprites[0].x += (16*18 - sprites[0].x) * 0.01;
      sprites[0].y += (16*6 - sprites[0].y) * 0.01;
      if (bubbles[0] && !bubbles[0].children.some(c => c.text && c.text === '💬 召集会议')) {
        const invite = new Text({ text: '💬 召集会议', style: { fontFamily: 'monospace', fontSize: 7, fill: 0xffaa00 } });
        invite.position.set(0, -25);
        bubbles[0].addChild(invite);
      }
    }
    if (meetingAgents.length >= 3) {
      if (!meetingStart) meetingStart = Date.now();
      meetingAgents.forEach(i => {
        if (bubbles[i]) {
          const hasMeeting = bubbles[i].children.some(c => c.text && c.text === '💬 会议中');
          if (!hasMeeting) {
            const mt = new Text({ text: '💬 会议中', style: { fontFamily: 'monospace', fontSize: 7, fill: 0xb46bff } });
            mt.position.set(0, -25);
            bubbles[i].addChild(mt);
          }
          // Rotating discussion content by task type
          const discussByType: Record<string, string[]> = {
            frontend: ['UI下周联调', '样式对齐设计', '响应式做完'],
            backend: ['API文档更新', '数据库加索引', '接口性能优化'],
            test: ['用例补全', '覆盖率80%', 'bug复现了'],
            general: ['下周上线', '有问题拉群', '排期确认']
          };
          const empTask = EMPLOYEES[i].task;
          const ttype = /ui|css|page|组件|样式/i.test(empTask) ? 'frontend' :
                        /api|db|接口|deploy|后端/i.test(empTask) ? 'backend' :
                        /test|测试|bug|用例/i.test(empTask) ? 'test' : 'general';
          const lines = discussByType[ttype];
          const discuss = lines[Math.floor(Date.now() / 4000) % lines.length];
          const hasDiscuss = bubbles[i].children.some(c => c.text && c.text.startsWith('💭'));
          if (hasDiscuss) {
            const old = bubbles[i].children.find(c => c.text && c.text.startsWith('💭'));
            if (old) old.text = `💭 ${discuss}`;
          } else {
            const dt = new Text({ text: `💭 ${discuss}`, style: { fontFamily: 'monospace', fontSize: 7, fill: 0xffdd00, wordWrap: true, wordWrapWidth: 80, lineHeight: 9 } });
            dt.position.set(0, -38);
            bubbles[i].addChild(dt);
          }
        }
      });
      // Meeting ends after 15 seconds → walk back to desks
      if (Date.now() - meetingStart > 15000) {
        meetingAgents.forEach(i => {
          returnToDesk(i);
          if (bubbles[i]) {
            const meetingChild = bubbles[i].children.find(c => c.text === '💬 会议中');
            if (meetingChild) bubbles[i].removeChild(meetingChild);
            const inviteChild = bubbles[i].children.find(c => c.text === '💬 召集会议');
            if (inviteChild) bubbles[i].removeChild(inviteChild);
          }
        });
        meetingStart = 0;
      }
    } else {
      meetingStart = 0;
      for (let i = 0; i < bubbles.length; i++) {
        if (bubbles[i]) {
          const meetingChild = bubbles[i].children.find(c => c.text && c.text === '💬 会议中');
          if (meetingChild) bubbles[i].removeChild(meetingChild);
          const discussChild = bubbles[i].children.find(c => c.text && c.text.startsWith('💭'));
          if (discussChild) bubbles[i].removeChild(discussChild);
        }
      }
    }

    // Auto-trigger next task in dependency chain
    depChains.forEach(chain => {
      for (let j = 0; j < chain.length - 1; j++) {
        if (EMPLOYEES[chain[j]].state === 'success' &&
            EMPLOYEES[chain[j+1]].state === 'idle') {
          EMPLOYEES[chain[j+1]].state = 'writing';
        }
      }
    });

    // Alert: flash dead_loop and error agents, click to clear
    const alertFlash = Math.floor(Date.now() / 500) % 2 === 0;
    const errCount = EMPLOYEES.filter(e => e.state === 'error' || e.state === 'dead_loop').length;
    alertCount.text = String(errCount);
    alertCount.style.fill = errCount > 0 ? 0xff3366 : 0x666666;
    alertBell.style.fill = errCount > 0 ? (alertFlash ? 0xff3366 : 0xffaa00) : 0x666666;
    for (let i = 0; i < sprites.length; i++) {
      if (EMPLOYEES[i].state === 'dead_loop' || EMPLOYEES[i].state === 'error') {
        sprites[i].alpha = alertFlash ? 1 : 0.5;
      }
    }
    // Click on alerting agent to clear
    world.on('pointertap', (e) => {
      const pos = world.toLocal(e.global);
      for (let i = 0; i < sprites.length; i++) {
        const dx = pos.x - sprites[i].x, dy = pos.y - sprites[i].y;
        if (Math.sqrt(dx*dx + dy*dy) < 15 &&
            (EMPLOYEES[i].state === 'error' || EMPLOYEES[i].state === 'dead_loop')) {
          EMPLOYEES[i].state = 'idle';
          EMPLOYEES[i].progress = 0;
        }
      }
    });

    for (let i = 0; i < EMPLOYEES.length; i++) {
      const emp = EMPLOYEES[i];
      const spr = sprites[i];
      // Pause visual: gray out
      const isPaused = pausedAgents.has(i);
      spr.alpha = isPaused ? 0.35 : 1;
      // Approved visual
      if (emp.state === 'success' && emp.progress >= 100) {
        spr.alpha = 1;
      }
      if (emp.walking) {
        const dx = emp.targetX - spr.x, dy = emp.targetY - spr.y;
        const dist = Math.sqrt(dx*dx+dy*dy);
        const speed = 40 * dt;
        if (dist < 4) {
          // Reached waypoint, go to next
          if (emp.pathIdx < emp.path.length - 1) {
            emp.pathIdx++;
            const next = emp.path[emp.pathIdx];
            emp.targetX = next.x*ts+ts/2;
            emp.targetY = next.y*ts+ts;
          } else {
            emp.walking = false;
          }
        } else {
          spr.x += (dx/dist)*speed; spr.y += (dy/dist)*speed;
        }
      }
      // Update bubble/name/status position every frame
      bubbles[i].x = spr.x; bubbles[i].y = spr.y - SCENE_H*spr.scale.y - 5;
      const col = i % 4;
      if (col === 1) bubbles[i].x -= 12;
      if (col === 2) bubbles[i].x += 12;
      if (col === 3) bubbles[i].x += 20;
      names[i].x = spr.x; names[i].y = spr.y + 2;
      statusIcons[i].x = spr.x; statusIcons[i].y = spr.y - SCENE_H*spr.scale.y - 14;
      if (emp.state === 'writing' || emp.state === 'thinking') {
        emp.progress = Math.min(100, emp.progress + dt*1.5);
        const bf = progressBars[i];
        bf.clear();
        bf.rect(4, 25, (LEFT_W-16)*emp.progress/100, 3).fill({ color: STATE_COLOR[emp.state] });
        tokenLabels[i].text = `◆${emp.tokens}`;
      }
      if (!emp.walking && emp.state === 'success') spr.y = Math.round(spr.y + Math.sin(ticker.lastTime/100)*0.3);
      if (!emp.walking && emp.state === 'dead_loop') spr.rotation = Math.sin(ticker.lastTime/80)*0.1;
      statusIcons[i].x = spr.x; statusIcons[i].y = spr.y - SCENE_H*spr.scale.y - 14;
    }
  });
}

main().catch(console.error);
