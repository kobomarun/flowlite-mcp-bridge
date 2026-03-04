# Usage Guide

This document explains all the ways a developer can integrate the FlowLite-MCP Bridge into their setup.

---

## Method 1: Install from npm (Recommended for most users)

Once the package is published to npm, you can run it directly with `npx` — no cloning required.

```bash
# Run directly without installing
npx flowlite-mcp-bridge --workflows-dir ./workflows --data-dir ./audit-trails --verbose

# Or install globally to use the `flowlite-mcp` command
npm install -g flowlite-mcp-bridge
flowlite-mcp --workflows-dir ./workflows --data-dir ./audit-trails
```

---

## Method 2: Clone & Run Locally (For contributors and local testing)

```bash
# Step 1: Clone the repo
git clone https://github.com/kobomarun/flowlite-mcp-bridge.git
cd flowlite-mcp-bridge

# Step 2: Install dependencies
npm install

# Step 3: Set up a demo playground (copies example workflows)
npm run setup-demo

# Step 4: Build and start the bridge
npm run build
node dist/cli/serve.js --workflows-dir ./playground/workflows --data-dir ./playground/data --verbose
```

When running with `--verbose`, you will see logs like:
```
info: Starting MCP Server: FlowLite MCP Bridge v0.1.0
info: Server connected and listening on stdin/stdout
debug: Incoming tool call: flowlite.runWorkflow
```

---

## Method 3: Claude Desktop Integration

Add this block to your `claude_desktop_config.json`:

**On Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**On Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "flowlite": {
      "command": "npx",
      "args": [
        "-y",
        "flowlite-mcp-bridge",
        "--workflows-dir", "/absolute/path/to/your/workflows",
        "--data-dir", "/absolute/path/to/store/audit-logs"
      ]
    }
  }
}
```

After restarting Claude Desktop, you will see a **🔌 FlowLite** tool indicator appear in the chat interface. You can then ask Claude things like:

> *"Run the invoice workflow for Acme Corp with amount 1250."*

---

## Method 4: Cursor IDE Integration

In Cursor, open **Settings → MCP** and add a new server:

```json
{
  "flowlite": {
    "command": "node",
    "args": [
      "/path/to/flowlite-mcp-bridge/dist/cli/serve.js",
      "--workflows-dir", "./workflows",
      "--data-dir", "./audit-trails"
    ]
  }
}
```

---

## CLI Reference

| Flag | Default | Description |
|------|---------|-------------|
| `-w, --workflows-dir <path>` | `./workflows` | Folder containing `.yml` workflow files |
| `-d, --data-dir <path>` | `./data` | Folder where audit trail JSON files are written |
| `-v, --verbose` | `false` | Enable debug-level logging |
| `--strict` | `false` | Block execution on any compliance violation |

---

## Writing Your First Workflow

Create a file at `./workflows/hello.yml`:

```yaml
id: hello-world
name: Hello World Workflow
version: 1.0.0
compliance:
  requiresHumanApproval: false
steps:
  - id: greet
    action: flowlite.log
    input:
      message: "Hello from FlowLite!"
```

Then call it from an AI client:

```json
{
  "method": "tools/call",
  "params": {
    "name": "flowlite.runWorkflow",
    "arguments": {
      "workflowId": "hello-world",
      "inputs": {}
    }
  }
}
```
---

## 🤖 Using LLMs in Workflows

The bridge supports FlowLite's native `LLMTool`. To use AI-driven steps in your workflows:

1.  **Set your API Key**: Ensure the environment where the bridge is running has access to an LLM provider.
    ```bash
    export OPENAI_API_KEY="your-key-here"
    ```
2.  **Use `flowlite.llm` in your YAML**:
    ```yaml
    - id: summarize
      action: flowlite.llm
      input:
        prompt: "Summarize: {{inputs.text}}"
    ```

For a full example, see [`examples/ai_summarizer.yml`](../examples/ai_summarizer.yml).
