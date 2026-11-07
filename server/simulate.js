// Simulation Agent - connects to WS server and registers mock agents
// Run: node server/simulate.js

import WebSocket from 'ws';

const WS_URL = process.env.WS_URL || 'ws://localhost:5175';

const MOCK_AGENTS = [
  { id: 'alice', name: 'Alice', role: 'Frontend Dev', adapter: 'crewai' },
  { id: 'bob', name: 'Bob', role: 'Backend Dev', adapter: 'crewai' },
  { id: 'charlie', name: 'Charlie', role: 'DevOps', adapter: 'otel' },
  { id: 'diana', name: 'Diana', role: 'PM', adapter: 'langfuse' },
  { id: 'evan', name: 'Evan', role: 'Data Engineer', adapter: 'crewai' },
  { id: 'fiona', name: 'Fiona', role: 'QA', adapter: 'otel' },
];

const STATES_CYCLE = ['idle', 'writing', 'thinking', 'calling_tool', 'error', 'dead_loop', 'success'];
const TASKS = ['Fix login bug', 'Optimize DB', 'Build API', 'Write tests', 'Deploy staging', 'Review PR'];
let cycleIndex = 0;

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('[SIM] Connected to', WS_URL);

  // Register all mock agents
  MOCK_AGENTS.forEach(a => {
    ws.send(JSON.stringify({ type: 'register', id: a.id, name: a.name, role: a.role, adapter: a.adapter }));
  });

  // Cycle through states every 3 seconds
  setInterval(() => {
    const state = STATES_CYCLE[cycleIndex % STATES_CYCLE.length];
    const task = TASKS[cycleIndex % TASKS.length];
    cycleIndex++;

    MOCK_AGENTS.forEach(a => {
      // Stagger progress and tokens per agent
      const progress = (cycleIndex * 15 + Math.random() * 20) % 100;
      const tokenBase = state === 'calling_tool' ? 500 : state === 'thinking' ? 200 : state === 'writing' ? 100 : 50;
      const tokens = Math.floor(tokenBase + Math.random() * 200);
      const trace = `[${new Date().toLocaleTimeString()}] ${state}: ${task}`;

      ws.send(JSON.stringify({
        type: 'status', id: a.id, state, task, progress, tokens, trace,
      }));
      ws.send(JSON.stringify({ type: 'heartbeat', id: a.id }));
    });
  }, 3000);
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'registered') {
    console.log(`[SIM] Registered: ${msg.agent.name} at seat (${msg.agent.seat.x}, ${msg.agent.seat.y})`);
  }
});

ws.on('error', (e) => console.error('[SIM] Error:', e.message));
ws.on('close', () => console.log('[SIM] Disconnected'));
