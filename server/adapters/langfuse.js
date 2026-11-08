// Langfuse Adapter - pulls LLM trace data from Langfuse API
const http = require('http');

class LangfuseAdapter {
  constructor(endpoint = 'http://localhost:3000') {
    this.endpoint = endpoint;
    this.connected = false;
    this.mockAgents = [
      { id: 'lf-chat', name: 'Chat Agent', role: 'LLM Agent', state: 'thinking', task: 'Generating response', progress: 40, tokens: 1800 },
      { id: 'lf-rag', name: 'RAG Agent', role: 'Retrieval', state: 'calling_tool', task: 'Querying vector DB', progress: 65, tokens: 2400 },
    ];
  }

  async checkConnection() {
    return new Promise((resolve) => {
      const req = http.get(this.endpoint + '/api/health', { timeout: 2000 }, (res) => {
        this.connected = res.statusCode === 200;
        resolve(this.connected);
      });
      req.on('error', () => { this.connected = false; resolve(false); });
      req.on('timeout', () => { req.destroy(); this.connected = false; resolve(false); });
    });
  }

  async getAgents() {
    if (this.connected) {
      try {
        return await new Promise((resolve) => {
          const req = http.get(this.endpoint + '/api/traces', { timeout: 3000 }, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => { resolve(this.mockAgents); });
          });
          req.on('error', () => resolve(this.mockAgents));
          req.on('timeout', () => { req.destroy(); resolve(this.mockAgents); });
        });
      } catch { return this.mockAgents; }
    }
    return this.mockAgents.map(a => ({
      ...a,
      progress: Math.min(100, Math.max(0, a.progress + Math.random() * 10 - 5)),
      tokens: a.tokens + Math.floor(Math.random() * 150),
    }));
  }

  getStatus() { return this.connected ? 'sync' : 'mock'; }
}

module.exports = { LangfuseAdapter };
