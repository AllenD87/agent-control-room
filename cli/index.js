#!/usr/bin/env node
// Agent Control Room CLI
const WebSocket = require('ws');

const ENDPOINT = process.env.ACR_ENDPOINT || 'ws://localhost:5175';

function connect() {
  const framework = process.argv[3] || 'crewai';
  const name = process.argv[4] || `cli-${Date.now() % 1000}`;
  const ws = new WebSocket(ENDPOINT);
  ws.on('open', () => {
    console.log(`[ACR] Connected to ${ENDPOINT}`);
    ws.send(JSON.stringify({
      type: 'register', id: name, name, role: 'CLI Agent', adapter: framework,
    }));
    setInterval(() => ws.send(JSON.stringify({ type: 'heartbeat', id: name })), 5000);
  });
  ws.on('message', (d) => {
    const msg = JSON.parse(d);
    if (msg.type === 'registered') console.log(`[ACR] Registered: ${msg.agent.name} at seat (${msg.agent.seat.x}, ${msg.agent.seat.y})`);
  });
}

function list() {
  const ws = new WebSocket(ENDPOINT);
  ws.on('open', () => {
    const agents = [];
    ws.on('message', (d) => {
      const msg = JSON.parse(d);
      if (msg.type === 'init' || msg.type === 'state') {
        (msg.agents || []).forEach(a => {
          console.log(`  ${a.id.padEnd(12)} ${a.name.padEnd(10)} ${a.state.padEnd(12)} ${a.tokens}tok`);
        });
        ws.close();
      }
    });
    setTimeout(() => ws.close(), 2000);
  });
}

function disconnectAgent() {
  const id = process.argv[3];
  if (!id) { console.log('Usage: acr disconnect <agent-id>'); process.exit(1); }
  const ws = new WebSocket(ENDPOINT);
  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'deregister', id }));
    console.log(`[ACR] Disconnected ${id}`);
    ws.close();
  });
}

function status() {
  const ws = new WebSocket(ENDPOINT);
  ws.on('open', () => {
    ws.on('message', (d) => {
      const msg = JSON.parse(d);
      if (msg.type === 'init' || msg.type === 'state') {
        console.log(`Agents: ${(msg.agents||[]).length}`);
        console.log(`Total tokens: ${msg.totalTokens || 'N/A'}`);
        if (msg.adapters) {
          Object.entries(msg.adapters).forEach(([k, v]) => {
            console.log(`  ${k}: ${v.status} (${v.agents} agents)`);
          });
        }
        ws.close();
      }
    });
    setTimeout(() => ws.close(), 2000);
  });
}

const cmd = process.argv[2];
switch (cmd) {
  case 'connect': connect(); break;
  case 'list': list(); break;
  case 'disconnect': disconnectAgent(); break;
  case 'status': status(); break;
  default:
    console.log(`Agent Control Room CLI

Usage:
  acr connect --framework <crewai|otel|langfuse> <name>
  acr list                    List connected agents
  acr disconnect <agent-id>   Disconnect an agent
  acr status                  Show server status
`);
}
