# Adapter Integration Guide

This document shows how to connect Agent Control Room to real agent frameworks.

## Quick Start

1. Edit `server/config.yaml`
2. Set `enabled: true` for the adapter you want
3. Set the correct `endpoint` and `api_key`
4. Changes take effect immediately (hot reload)

---

## 1. CrewAI Adapter

### What it does
Pulls real-time agent states from your CrewAI application.

### Configuration
```yaml
adapters:
  crewai:
    enabled: true
    endpoint: "http://localhost:8000"   # Your CrewAI API server
    api_key: ""                           # Optional: if your API requires auth
    poll_interval: 5000                   # How often to poll (ms)
```

### Expected API format
Your CrewAI server should expose `GET /agents`:

```json
[
  {
    "id": "agent-1",
    "name": "Frontend Agent",
    "role": "UI Developer",
    "state": "writing",
    "task": "Building dashboard",
    "progress": 65,
    "tokens": 1240
  },
  {
    "id": "agent-2",
    "name": "Backend Agent",
    "role": "API Developer",
    "state": "calling_tool",
    "task": "Processing requests",
    "progress": 30,
    "tokens": 2800
  }
]
```

### State values
- `idle` - waiting for task
- `writing` - producing output
- `thinking` - reasoning/planning
- `calling_tool` - using external tool/API
- `error` - encountered error
- `dead_loop` - stuck in loop
- `success` - completed task

### Example CrewAI integration
```python
# In your CrewAI app, add an HTTP endpoint
from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

app = FastAPI()

class AgentState(BaseModel):
    id: str
    name: str
    role: str
    state: str
    task: str
    progress: int
    tokens: int

# Track your agents here
agents_db = []

@app.get("/agents")
def get_agents():
    return agents_db

# When your agent starts working:
agents_db.append(AgentState(
    id="agent-1",
    name="My Agent",
    role="Worker",
    state="writing",
    task="Processing data",
    progress=50,
    tokens=800
))

uvicorn.run(app, port=8000)
```

---

## 2. OpenTelemetry (OTel) Adapter

### What it does
Pulls span/trace data from your OTel collector and maps it to agent states.

### Configuration
```yaml
adapters:
  otel:
    enabled: true
    endpoint: "http://localhost:4318"   # OTel collector HTTP endpoint
    service_name: "my-agent-service"      # Filter by service name
    poll_interval: 10000
```

### Expected data format
OTel collector exposes traces via HTTP. The adapter queries recent spans and maps:
- Long-running spans → `writing`
- Quick bursts → `thinking`
- Error spans → `error`
- Completed spans → `success`

### Example OTel setup
```python
# In your agent code, send telemetry
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

trace.set_tracer_provider(TracerProvider())
tracer = trace.get_tracer(__name__)

exporter = OTLPSpanExporter(endpoint="http://localhost:4318/v1/traces")
trace.get_tracer_provider().add_span_processor(BatchSpanProcessor(exporter))

# Your agent activity becomes a span
with tracer.start_as_current_span("agent-work") as span:
    span.set_attribute("agent.name", "My Agent")
    span.set_attribute("agent.state", "writing")
    # ... do work
```

---

## 3. Langfuse Adapter

### What it does
Pulls LLM trace data from Langfuse and maps generations to agent states.

### Configuration
```yaml
adapters:
  langfuse:
    enabled: true
    endpoint: "http://localhost:3000"   # Langfuse server
    public_key: "pk-lf-xxx"              # Your Langfuse public key
    secret_key: "sk-lf-xxx"              # Your Langfuse secret key
    poll_interval: 5000
```

### Expected data format
Langfuse API returns generations. The adapter maps:
- Active generations → `writing`
- Pending evaluations → `thinking`
- Errors → `error`
- Completed → `success`

### Example Langfuse setup
```python
from langfuse import Langfuse

langfuse = Langfuse(
    public_key="pk-lf-xxx",
    secret_key="sk-lf-xxx",
    host="http://localhost:3000"
)

# Track your LLM calls
generation = langfuse.generation(
    name="agent-response",
    model="gpt-4",
    prompt="Write code...",
    completion="Here's the code...",
    metadata={"agent": "My Agent", "state": "writing"}
)
```

---

## Mock Mode

If an adapter is disabled or unreachable, the system falls back to **mock mode**:
- 8 simulated agents cycle through states every 3 seconds
- Useful for development and demoing
- No real API calls needed

## Hot Reload

Edit `server/config.yaml` while the server is running — changes apply automatically without restarting.
