# Agent Control Room Python SDK

一键接入 Agent Control Room 监控平台。

## 安装

```bash
pip install websocket-client
```

## 快速开始

```python
from agent_control_room import Agent

# 创建 Agent，自动注册 + 心跳
alice = Agent(
    agent_id="alice",
    name="Alice",
    role="Frontend Dev",
    endpoint="ws://localhost:5175",
    adapter="crewai",
)

# 上报状态
alice.state = "writing"
alice.current_task = "Fix login bug"
alice.progress = 0.45

# 上报 trace
alice.trace("Reading login.py...")
alice.trace("Found bug at line 42")
alice.add_tokens(150)

# 完成
alice.state = "success"

# 断开
alice.disconnect()
```

## 支持的状态

| 状态 | 说明 |
|------|------|
| idle | 待命 |
| writing | 写代码 |
| thinking | 思考方案 |
| calling_tool | 调用工具 |
| error | 报错 |
| dead_loop | 死循环 |
| success | 完成 |

## 适配器

- `crewai` - CrewAI 框架
- `otel` - OpenTelemetry
- `langfuse` - Langfuse trace
