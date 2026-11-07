// CrewAI Adapter - connects to CrewAI API and pulls agent states
// Falls back to mock data if CrewAI API is not available

const http = require('http');

class CrewAIAdapter {
  constructor(endpoint = 'http://localhost:8000') {
    this.endpoint = endpoint;
    this.connected = false;
    this.mockAgents = [
      { id: 'crew-frontend', name: 'Frontend Agent', role: 'Frontend Dev', state: 'writing', task: 'Building UI', progress: 60, tokens: 1200 },
      { id: 'crew-backend', name: 'Backend Agent', role: 'Backend Dev', state: 'calling_tool', task: 'API calls', progress: 35, tokens: 2400 },
      { id: 'crew-tester', name: 'QA Agent', role: 'Tester', state: 'thinking', task: 'Writing tests', progress: 80, tokens: 800 },
    ];
  }

  async checkConnection() {
    return new Promise((resolve) => {
      const req = http.get(this.endpoint + '/agents', { timeout: 2000 }, (res) => {
        this.connected = res.statusCode === 200;
        resolve(this.connected);
      });
      req.on('error', () => { this.connected = false; resolve(false); });
      req.on('timeout', () => { req.destroy(); this.connected = false; resolve(false); });
    });
  }

  async getAgents() {
    if (this.connected) {
      // Real CrewAI API call
      try {
        return await new Promise((resolve, reject) => {
          const req = http.get(this.endpoint + '/agents', { timeout: 3000 }, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => {
              try { resolve(JSON.parse(data)); } catch { resolve(this.mockAgents); }
            });
          });
          req.on('error', () => resolve(this.mockAgents));
          req.on('timeout', () => { req.destroy(); resolve(this.mockAgents); });
        });
      } catch {
        return this.mockAgents;
      }
    }
    // Fallback: return mock data with slight variation
    return this.mockAgents.map(a => ({
      ...a,
      progress: Math.min(100, Math.max(0, a.progress + Math.random() * 10 - 5)),
      tokens: a.tokens + Math.floor(Math.random() * 100),
    }));
  }

  getStatus() {
    return this.connected ? 'online' : 'mock';
  }
}

module.exports = { CrewAIAdapter };
