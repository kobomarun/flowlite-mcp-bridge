# FlowLite MCP Bridge 🌉

[![CI Status](https://github.com/kobomarun/flowlite-mcp-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/kobomarun/flowlite-mcp-bridge/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> A **Model Context Protocol (MCP) server** that exposes FlowLite workflow automation as structured, auditable AI tools — with built-in compliance gates and non-repudiable audit trails.

---

## 🤔 Why does this exist?

Modern AI agents (Claude, GPT-4o, Llama) are powerful, but they need a **safe, structured way** to trigger real-world automations. Without governance, an AI could:
- Execute a payment without a human approving it.
- Take an irreversible action with no trace left behind.
- Access sensitive data it shouldn't.

**FlowLite-MCP Bridge solves this.** It wraps your FlowLite workflows in a battle-hardened protocol that forces the AI to go through compliance gates before any action runs.

---

## 🚀 Quickstart (3 commands)

```bash
# 1. Clone and install
git clone https://github.com/kobomarun/flowlite-mcp-bridge.git && cd flowlite-mcp-bridge && npm install

# 2. Build and set up your demo playground
npm run build && npm run setup-demo

# 3. Start the bridge
node dist/cli/serve.js --workflows-dir ./playground/workflows --data-dir ./playground/data --verbose
```

---

## 🛠️ Example MCP Tool Calls

### Parse a natural language message:
```json
{
  "method": "tools/call",
  "params": {
    "name": "flowlite.parseMessage",
    "arguments": { "message": "Process invoice #445 for Acme Corp", "locale": "en-US" }
  }
}
```

### Run a workflow (standard):
```json
{
  "method": "tools/call",
  "params": {
    "name": "flowlite.runWorkflow",
    "arguments": {
      "workflowId": "process-invoice",
      "inputs": { "invoiceId": "INV-001", "amount": 1250.50, "vendorName": "Acme" },
      "humanApprovalGranted": false
    }
  }
}
```

### Get an audit trail:
```json
{
  "method": "tools/call",
  "params": {
    "name": "flowlite.getAuditTrail",
    "arguments": { "runId": "run-abc-123" }
  }
}
```

> See the full [`examples/`](./examples) folder for all supported tool call schemas.

---

## 🤖 AI Integration (Claude Desktop / Cursor)

Add this to your `claude_desktop_config.json` or Cursor MCP config:

```json
{
  "mcpServers": {
    "flowlite": {
      "command": "node",
      "args": [
        "/absolute/path/to/flowlite-mcp-bridge/dist/cli/serve.js",
        "--workflows-dir", "./workflows",
        "--data-dir", "./audit-trails"
      ]
    }
  }
}
```

This works with **any MCP-compatible AI client**, including:
- 🟣 **Claude Desktop** (Anthropic)
- 🔵 **Cursor** (via MCP extension)
- 🟢 **Windsurf** (Codeium)
- 🧡 **Ollama + Open WebUI** (local models)

---

## 🏗️ Architecture

```mermaid
graph TD
    Client(["AI Client (Claude / GPT / Llama)"]) -->|1. List Tools| Protocol[MCP Protocol Layer]
    Protocol -->|2. Serve Manifest| Manifest[Tool Manifest]
    Client -->|3. Call flowlite.runWorkflow| Router[Tool Handler Router]
    Router -->|4. Validate Schema| Zod((Zod Engine))
    Router -->|5. Check Compliance| Adapter[FlowLite Adapter]
    Adapter -->|6. Load YAML| FS[(Workflows Folder)]
    Adapter -->|7. Execute Workflow| Engine[FlowLite Engine]
    Adapter -->|8. Persist Trace| Audit[(Audit Trail Store)]
    Adapter -->|9. Result + Metadata| Router
    Router -->|10. MCP Response| Client
```

> Full details in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)

---

## 🚦 Governance & Safety

| Feature | Status |
|---|---|
| Human-in-the-Loop (HITL) approval gates | ✅ Enforced |
| Non-repudiable audit trail per run | ✅ Enforced |
| Data Classification levels | ✅ Enforced |
| Strict Zod schema validation at boundary | ✅ Enforced |
| Path traversal protection | ✅ Enforced |

> Full details in [`docs/GOVERNANCE.md`](./docs/GOVERNANCE.md)

---

## 🗺️ Roadmap

See [`ROADMAP.md`](./ROADMAP.md) for the full vision from Phase 1 (Foundation) to Phase 4 (Community & Ecosystem).

---

## 🤝 Contributing

We welcome contributions! Start here:

1. Read [`CONTRIBUTING.md`](./CONTRIBUTING.md) for technical standards (strict TypeScript, no `any`, schema-first design).
2. Check open [Issues](https://github.com/kobomarun/flowlite-mcp-bridge/issues) for tasks.
3. Use the [PR template](.github/pull_request_template.md) when submitting.

---

## 📜 License

[MIT](LICENSE) — Free to use, modify, and distribute.
