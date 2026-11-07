# Agent Control Room CLI

命令行工具，一键接入和管理 Agent Control Room。

## 安装

```bash
cd cli
npm install
npm link
```

## 使用

```bash
# 接入一个 Agent
acr connect --framework crewai my-agent

# 查看所有已接入 Agent
acr list

# 断开某个 Agent
acr disconnect my-agent

# 查看服务器状态
acr status
```

## 环境变量

- `ACR_ENDPOINT` - WebSocket 地址（默认 `ws://localhost:5175`）
