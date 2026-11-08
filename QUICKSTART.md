# 🚀 Quick Start Guide - Agent Control Room

## Prerequisites

- **Node.js 18+** (https://nodejs.org/)
- **npm** (comes with Node.js)

## One-Click Start

```bash
chmod +x start.sh
./start.sh
```

This will:
1. Install all dependencies (first time only)
2. Start WebSocket backend on port 5175
3. Start mock agent simulator (8 fake agents for demo)
4. Start frontend on port 5174
5. Open browser automatically

Then open: **http://localhost:5174/**

---

## 📡 Connecting Your Own AI Agents

### Option A: Use the Mock Simulator (for demo)

No setup needed. The simulator already registers 8 fake agents that cycle through all states.

### Option B: Python SDK (for your own agents)

```python
# pip install agent-control-room
from agent_control_room import AgentControlRoom

client = AgentControlRoom(
    name="Alice",           # Your agent name
    role="Frontend Dev",    # Role description
    server_url="ws://localhost:5175/"
)

# Register and start heartbeat
client.register()

# Update state as your agent works
client.update_state("writing", task="Fix login bug", progress=45.5, tokens=1280)
client.update_state("calling_tool", task="Call API", progress=60, tokens=1500)
client.update_state("success", task="Fix login bug", progress=100, tokens=2000)

# Add trace steps
client.add_trace("POST /api/login", time="12:00:01", duration_ms=120)

# Cleanup
client.disconnect()
```

### Option C: Node.js / CLI Tool

```bash
# List connected agents
node cli/index.js list

# Connect a new agent
node cli/index.js connect --name "Bob" --role "Backend"

# Disconnect
node cli/index.js disconnect --name "Bob"
```

---

## 🔌 Adapters: Connect to Real Tracing Platforms

### 1. CrewAI Adapter

**Config file**: `server/config.yaml`

```yaml
adapters:
  crewai:
    enabled: true
    api_url: "http://localhost:11434"  # Your CrewAI endpoint
    api_key: ""                          # Optional API key
    poll_interval: 5000                  # ms between polls
```

**How it works**:
- The adapter polls your CrewAI server every 5 seconds
- Pulls agent states, task progress, token usage
- Falls back to mock data if CrewAI is unreachable
- No code changes needed in your CrewAI project

### 2. OTel (OpenTelemetry) Adapter

```yaml
adapters:
  otel:
    enabled: true
    collector_url: "http://localhost:4318"  # OTel collector endpoint
    service_name: "my-ai-app"
    poll_interval: 5000
```

**How to configure your app to send traces**:
```python
# In your AI application
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

# Point OTel exporter at the collector
provider = TracerProvider()
processor = BatchSpanProcessor(OTLPSpanExporter(endpoint="http://localhost:4318/v1/traces"))
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)
```

### 3. Langfuse Adapter

```yaml
adapters:
  langfuse:
    enabled: true
    public_key: "pk-lf-xxx"        # Your Langfuse public key
    secret_key: "sk-lf-xxx"        # Your Langfuse secret key
    host: "https://cloud.langfuse.com"
    poll_interval: 5000
```

**Steps**:
1. Sign up at https://cloud.langfuse.com (or self-host)
2. Create a new project
3. Copy your public_key and secret_key
4. Paste into `server/config.yaml`
5. Config hot-reloads automatically — no restart needed

---

## 🎨 Customization

### Change agent names / spawn positions
Edit `src/main.ts` — search for `spawnPoints` or `EMPLOYEES`.

### Change map / office layout
Replace `public/maps/office.tmj` (Tiled Map Editor format, 16px tiles).

### Change theme colors
Edit the `C = { ... }` object at the top of `src/main.ts`.

---

## 📁 Project Structure

```
agent-control-room-v2/
├── start.sh              # One-click start script
├── package.json
├── server/
│   ├── index.js          # WebSocket server (port 5175)
│   ├── simulate.js       # Mock agent simulator
│   ├── adapters/
│   │   ├── crewai.js     # CrewAI adapter
│   │   ├── otel.js       # OTel adapter
│   │   └── langfuse.js   # Langfuse adapter
│   └── config.yaml       # Adapter config (hot-reload)
├── sdk/python/          # Python SDK
├── cli/                  # Node.js CLI tool
├── src/
│   └── main.ts           # Main frontend (PixiJS)
└── public/
    └── maps/office.tmj   # Office map
```

---

## ❓ Troubleshooting

**Port already in use**:
```bash
npx kill-port 5174 5175
./start.sh
```

**Dependencies broken**:
```bash
rm -rf node_modules package-lock.json
npm install
./start.sh
```

**WebGL not supported**:
The app uses PixiJS v8 which requires WebGL. Try Chrome, Firefox, or Edge latest.
