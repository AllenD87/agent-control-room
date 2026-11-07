"""Agent Control Room Python SDK

Usage:
    from agent_control_room import Agent

    alice = Agent(agent_id="alice", name="Alice", endpoint="ws://localhost:5175")
    alice.state = "writing"
    alice.current_task = "Fix login bug"
    alice.progress = 0.45
    alice.trace("Read login.py")
    alice.trace("Found bug at line 42")
    alice.state = "success"
"""

import json
import threading
import time
import uuid
import websocket


class Agent:
    def __init__(self, agent_id=None, name="Agent", role="Engineer",
                 endpoint="ws://localhost:5175", adapter="crewai"):
        self.agent_id = agent_id or str(uuid.uuid4())[:8]
        self.name = name
        self.role = role
        self.endpoint = endpoint
        self.adapter = adapter
        self._state = "idle"
        self._task = "Idle"
        self._progress = 0.0
        self._tokens = 0
        self._ws = None
        self._connected = False
        self._heartbeat_thread = None
        self._stop = False
        self._connect()
        self._register()
        self._start_heartbeat()

    def _connect(self):
        try:
            self._ws = websocket.create_connection(self.endpoint, timeout=5)
            self._connected = True
            print(f"[ACR] Connected to {self.endpoint}")
        except Exception as e:
            print(f"[ACR] Connection failed: {e}")

    def _register(self):
        if not self._connected:
            return
        msg = {
            "type": "register",
            "id": self.agent_id,
            "name": self.name,
            "role": self.role,
            "adapter": self.adapter,
        }
        self._send(msg)

    def _start_heartbeat(self):
        def beat():
            while not self._stop and self._connected:
                try:
                    self._send({"type": "heartbeat", "id": self.agent_id})
                    time.sleep(5)
                except Exception:
                    break
        self._heartbeat_thread = threading.Thread(target=beat, daemon=True)
        self._heartbeat_thread.start()

    def _send(self, msg):
        if self._connected and self._ws:
            try:
                self._ws.send(json.dumps(msg))
            except Exception:
                self._connected = False

    def _report_status(self):
        self._send({
            "type": "status",
            "id": self.agent_id,
            "state": self._state,
            "task": self._task,
            "progress": int(self._progress * 100),
            "tokens": self._tokens,
        })

    @property
    def state(self):
        return self._state

    @state.setter
    def state(self, value):
        self._state = value
        self._report_status()

    @property
    def current_task(self):
        return self._task

    @current_task.setter
    def current_task(self, value):
        self._task = value
        self._report_status()

    @property
    def progress(self):
        return self._progress

    @progress.setter
    def progress(self, value):
        self._progress = value
        self._report_status()

    def trace(self, action):
        """Report a trace step."""
        t = time.strftime("%H:%M:%S")
        self._send({
            "type": "status",
            "id": self.agent_id,
            "trace": f"[{t}] {action}",
        })

    def add_tokens(self, n):
        self._tokens += n
        self._report_status()

    def disconnect(self):
        self._stop = True
        self._send({"type": "deregister", "id": self.agent_id})
        if self._ws:
            self._ws.close()
        self._connected = False
        print(f"[ACR] {self.name} disconnected")
