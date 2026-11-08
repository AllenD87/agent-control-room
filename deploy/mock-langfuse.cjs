// Minimal Langfuse mock server - responds to health and generations API
// This simulates Langfuse's API so the adapter shows "online"
const http = require('http');

const agents = [
  { id: 'lf-agent-1', name: 'Langfuse Agent 1', state: 'writing', task: 'LLM generation', progress: 45, tokens: 1500 },
  { id: 'lf-agent-2', name: 'Langfuse Agent 2', state: 'thinking', task: 'Evaluating output', progress: 70, tokens: 2200 },
];

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/api/public/health' || req.url === '/health' || req.url === '/') {
    res.end(JSON.stringify({ status: 'ok', version: '2.0.0', mock: true }));
  } else if (req.url === '/api/public/generations' || req.url === '/generations') {
    // Mock generations list
    res.end(JSON.stringify({
      data: agents.map(a => ({
        id: a.id,
        name: a.name,
        model: 'gpt-4',
        state: a.state,
        progress: a.progress,
        usage: { totalTokens: a.tokens },
        startTime: new Date().toISOString(),
      })),
      meta: { total: agents.length }
    }));
  } else {
    res.end(JSON.stringify({ status: 'ok', mock: true }));
  }
});

server.listen(3000, '0.0.0.0', () => {
  console.log('Mock Langfuse server running on http://localhost:3000');
});
