# 🎮 Agent Control Room

> 把你的 AI Agent 团队放进一个虚拟办公室，像看监控大屏一样实时掌握每个 Agent 的工作状态。

![Banner](https://img.shields.io/badge/Agent-Visualization-purple) ![Status](https://img.shields.io/badge/status-MVP-orange) ![Tech](https://img.shields.io/badge/tech-PixJS%20%7C%20WebSocket-blue)

---

## ✨ 亮点

- 🗺️ **空间化身式可视化** — 每个 Agent 有自己的工位，不是干巴巴的列表
- 🎭 **7 种状态实时演绎** — 写代码、思考、调工具、报错、死循环、成功，每种状态有专属表情动画
- 🔌 **热插拔接入** — 新 Agent 启动自动出现在地图上，停止自动消失，不重启
- 📡 **WebSocket 实时推送** — 状态变化毫秒级同步
- 🎨 **赛博朋克控制室风格** — 霓虹发光 + 深色背景，科技感拉满
- 📊 **全维度监控** — Token 消耗、任务进度、Trace 路径、事件日志，一屏全掌握

---

## 🖼️ 效果预览

![Demo GIF](docs/images/demo.gif)

### 主界面

![主界面](docs/images/screenshot_main.png)

### 状态展示

![状态展示](docs/images/screenshot_states.png)

### 员工走动

![员工走动](docs/images/screenshot_moving.png)

---

## 🎯 核心功能

### 状态机（7 种状态）
| 状态 | 图标 | 视觉表现 |
|------|------|----------|
| idle | 💤 | 待命，灰色气泡 |
| writing | 💻 | 写代码，白色气泡 |
| thinking | 💭 | 思考，紫色气泡 |
| calling_tool | 🔧 | 调工具，绿色气泡 + 走去茶水间 |
| error | ❗ | 报错，红色气泡 + 抱头 + 走去会议室 |
| dead_loop | 🔄 | 死循环，黄色气泡 + 晕头转向 |
| success | ✨ | 成功，绿色气泡 + 开心庆祝 |

### 多智能体协作
- 员工之间互相对话（"这个接口帮我看下"）
- 多人开会场景（会议室讨论）
- 任务依赖流转（A 完成 → B 开始）

### 监控面板
- 📊 状态分布饼图
- 📈 Token 消耗趋势折线图
- 📈 实时活动量曲线
- 📊 7 日任务完成柱状图
- 💎 Token 消耗排行
- 🔌 Adapter 状态（CrewAI / OTel / Langfuse）

---

## 🏗️ 架构

```
┌─────────────────────────────────────────┐
│     Agent Control Room 前端（PixiJS）    │
└───────────────┬─────────────────────────┘
                │ WebSocket
        ┌───────▼───────┐
        │   注册中心     │
        │   Registry    │
        │   心跳检测     │
        │   工位分配     │
        └───────┬───────┘
                │
    ┌───────────┼───────────┐
    │           │           │
┌───▼───┐  ┌───▼───┐  ┌───▼───┐
│CrewAI │  │  OTel  │  │Langfuse│
│Adapter│  │Adapter│  │Adapter │
└───────┘  └───────┘  └───────┘
```

### 热插拔协议
```json
// 注册
{ "type": "register", "agent_id": "alice", "name": "Alice" }

// 状态上报
{ "type": "state", "agent_id": "alice", "state": "writing", "progress": 0.45, "tokens": 328 }

// 心跳
{ "type": "heartbeat", "agent_id": "alice" }

// 注销
{ "type": "deregister", "agent_id": "alice" }
```

---

## 🚀 快速开始

```bash
# 克隆仓库
git clone https://github.com/AllenD87/agent-control-room.git
cd agent-control-room

# 安装依赖
npm install

# 启动 WebSocket 服务器
node server/index.js

# 启动模拟 Agent
node server/simulate.js

# 启动前端
npm run dev
```

打开浏览器访问 `http://localhost:5174` 即可看到效果。

---

## 🧩 接入你的 Agent

### Python SDK（开发中）

```python
from agent_control_room import Agent

alice = Agent(agent_id="alice", name="Alice")
alice.state = "writing"
alice.current_task = "Fix login bug"
alice.progress = 0.45
```

### 手动接入

```bash
# 发送 WebSocket 消息注册
wscat -c ws://localhost:5175
> {"type": "register", "agent_id": "my_agent", "name": "My Agent"}
```

---

## 🛠️ 技术栈

- **前端：** PixiJS（像素风渲染）+ Vite + 原生 JS
- **后端：** Node.js + WebSocket (ws)
- **风格：** 赛博朋克霓虹风 / Glassmorphism / 黑客帝国终端（可切换）
- **素材：** Munder Difflin 开源像素办公室

---

## 📋 Roadmap

- [x] M1: 像素风办公室 + 7 种状态机 + 产品 UI
- [x] M2: WebSocket 后端 + 注册中心 + 3 个 Adapter
- [ ] M3: Python SDK + CLI 工具 + Adapter 模板
- [ ] M4: 用户化身交互（走到员工旁边暂停/approve）
- [ ] M5: 历史记录回看 + 大屏模式
- [ ] M6: 真实 CrewAI / OTel / Langfuse 数据对接

---

## 📄 License

MIT

---

**Star 一下不迷路 ⭐**
