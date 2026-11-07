// Agent Control Room - WebSocket Server
// Handles: agent registration, heartbeat, state broadcast, adapter ingestion

import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '5175');

// ===== Agent Registry =====
const agents = new Map();
const history = [];
const MAX_HISTORY = 720;

// ===== Config Hot Reload =====
const CONFIG_PATH = path.join(__dirname, 'config.yaml');
let config = { adapters: { crewai: {enabled:true}, otel: {enabled:true}, langfuse: {enabled:true} } };

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    // Simple YAML parser (no external deps)
    const lines = raw.split('\n');
    let section = '', sub = '';
    lines.forEach(line => {
      if (line.match(/^  (\w+):$/)) { section = line.trim().replace(':',''); sub=''; }
      else if (line.match(/^    (\w+):$/)) { sub = line.trim().replace(':',''); }
      else if (line.match(/^      (\w+):\s*(.+)$/)) {
        const [k,v] = line.trim().split(': ');
        if (!config.adapters[section]) config.adapters[section] = {};
        config.adapters[section][k] = v.replace(/"/g,'');
      }
    });
    console.log('[CONFIG] Reloaded from', CONFIG_PATH);
  } catch(e) { console.log('[CONFIG] Using defaults'); }
}
loadConfig();
fs.watch(CONFIG_PATH, () => { setTimeout(loadConfig, 100); });
const seats = [
  { x: 2, y: 13 }, { x: 6, y: 13 }, { x: 10, y: 13 }, { x: 14, y: 13 },
  { x: 2, y: 18 }, { x: 6, y: 18 }, { x: 10, y: 18 }, { x: 14, y: 18 },
];
const usedSeats = new Set();

// ===== Adapters =====
const adapters = {
  crewai: { name: 'CrewAI', status: 'online', agents: 0 },
  otel: { name: 'OTel', status: 'online', agents: 0 },
  langfuse: { name: 'Langfuse', status: 'sync', agents: 0 },
};

function assignSeat(agentId) {
  for (let i = 0; i < seats.length; i++) {
    if (!usedSeats.has(i)) {
      usedSeats.add(i);
      return { ...seats[i], index: i };
    }
  }
  return { x: 16, y: 14, index: -1 }; // overflow area
}

function releaseSeat(agentId) {
  const agent = agents.get(agentId);
  if (agent && agent.seatIndex >= 0) {
    usedSeats.delete(agent.seatIndex);
  }
}

function broadcast(type, data) {
  const msg = JSON.stringify({ type, ...data, ts: Date.now() });
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

function broadcastState() {
  const list = Array.from(agents.values()).map(a => ({
    id: a.id, name: a.name, role: a.role, state: a.state,
    task: a.task, progress: a.progress, tokens: a.tokens,
    seat: a.seat, trace: a.trace.slice(-10),
  }));
  // Record history
  history.push({ ts: Date.now(), agents: list });
  if (history.length > MAX_HISTORY) history.shift();
  broadcast('state', { agents: list, adapters, totalTokens: list.reduce((s, a) => s + a.tokens, 0) });
}

// ===== HTTP Server (serves static files + WS upgrade) =====
const server = http.createServer((req, res) => {
  // Serve static files from dist or public
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, '..', filePath.startsWith('/') ? filePath.slice(1) : filePath);

  const ext = path.extname(filePath);
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' }[ext] || 'text/plain';

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  console.log('[WS] Client connected');

  // Send initial state
  ws.send(JSON.stringify({ type: 'init', agents: Array.from(agents.values()).map(a => ({
    id: a.id, name: a.name, role: a.role, state: a.state, task: a.task,
    progress: a.progress, tokens: a.tokens, seat: a.seat, trace: a.trace.slice(-10),
  })), adapters, ts: Date.now() }));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    switch (msg.type) {
      case 'register': {
        // { id, name, role, adapter }
        const agent = {
          id: msg.id, name: msg.name, role: msg.role || 'Engineer',
          state: 'idle', task: 'Idle', progress: 0, tokens: 0,
          seat: assignSeat(msg.id), seatIndex: -1,
          lastSeen: Date.now(), trace: [], adapter: msg.adapter || 'crewai',
        };
        // Store seat index
        const seatIdx = seats.findIndex(s => s.x === agent.seat.x && s.y === agent.seat.y);
        agent.seatIndex = seatIdx;
        agents.set(msg.id, agent);
        adapters[msg.adapter] && adapters[msg.adapter].agents++;
        console.log(`[REG] ${msg.name} (${msg.id}) registered, seat=${JSON.stringify(agent.seat)}`);
        broadcast('registered', { agent: { id: agent.id, name: agent.name, role: agent.role, state: agent.state, task: agent.task, progress: agent.progress, tokens: agent.tokens, seat: agent.seat } });
        broadcastState();
        break;
      }
      case 'heartbeat': {
        const agent = agents.get(msg.id);
        if (agent) {
          agent.lastSeen = Date.now();
        }
        break;
      }
      case 'status': {
        // { id, state, task, progress, tokens, trace }
        const agent = agents.get(msg.id);
        if (!agent) break;
        if (msg.state) agent.state = msg.state;
        if (msg.task !== undefined) agent.task = msg.task;
        if (msg.progress !== undefined) agent.progress = msg.progress;
        if (msg.tokens !== undefined) agent.tokens = msg.tokens;
        if (msg.trace) agent.trace.push(msg.trace);
        agent.lastSeen = Date.now();
        broadcast('status', { id: agent.id, state: agent.state, task: agent.task, progress: agent.progress, tokens: agent.tokens, trace: msg.trace });
        broadcastState();
        break;
      }
      case 'deregister': {
        const agent = agents.get(msg.id);
        if (agent) {
          releaseSeat(msg.id);
          adapters[agent.adapter] && adapters[agent.adapter].agents--;
          agents.delete(msg.id);
          console.log(`[DEL] ${msg.name || msg.id} deregistered`);
          broadcast('deregistered', { id: msg.id });
          broadcastState();
        }
        break;
      }
      case 'get_history': {
        ws.send(JSON.stringify({ type: 'history', history }));
        break;
      }
    }
  });

  ws.on('close', () => console.log('[WS] Client disconnected'));
});

// ===== Heartbeat Monitor =====
setInterval(() => {
  const now = Date.now();
  const toRemove = [];
  agents.forEach((agent, id) => {
    const lost = now - agent.lastSeen;
    if (lost > 30000) {
      toRemove.push(id);
    } else if (lost > 10000) {
      // Mark as offline after 10s lost
      if (agent.state !== 'offline') {
        agent.state = 'offline';
        broadcast('offline', { id, lost });
        broadcastState();
      }
    }
  });
  toRemove.forEach(id => {
    const agent = agents.get(id);
    console.log(`[TIMEOUT] Removing ${agent?.name || id} after 30s`);
    releaseSeat(id);
    adapters[agent?.adapter] && adapters[agent?.adapter].agents--;
    agents.delete(id);
    broadcast('deregistered', { id, reason: 'timeout' });
    broadcastState();
  });
}, 5000);

// ===== Simulation: auto-register mock agents =====
// Uncomment to auto-simulate agents on startup
/*
setTimeout(() => {
  const mockAgents = [
    { id: 'alice', name: 'Alice', role: 'Frontend Dev', adapter: 'crewai' },
    { id: 'bob', name: 'Bob', role: 'Backend Dev', adapter: 'crewai' },
    { id: 'charlie', name: 'Charlie', role: 'DevOps', adapter: 'otel' },
  ];
  mockAgents.forEach(a => {
    agents.set(a.id, {
      ...a, state: 'writing', task: 'Building features', progress: Math.random() * 50,
      tokens: Math.floor(Math.random() * 500), seat: assignSeat(a.id),
      seatIndex: -1, lastSeen: Date.now(), trace: [], adapter: a.adapter,
    });
    const seatIdx = seats.findIndex(s => s.x === agents.get(a.id).seat.x && s.y === agents.get(a.id).seat.y);
    agents.get(a.id).seatIndex = seatIdx;
  });
  broadcastState();
}, 1000);
*/

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] Agent Control Room WS server on http://0.0.0.0:${PORT}`);
  console.log(`[SERVER] Agents: ${agents.size}, Seats: ${seats.length}`);
});
