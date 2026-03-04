# Architecture Philosophy

The FlowLite-MCP Bridge is designed with a **Protocol-Agnostic Core**. While it currently uses the Model Context Protocol (MCP) as its primary interface, the business logic is entirely decoupled.

## 🌉 The Adapter Pattern
We utilize the **Adapter Pattern** to wrap the FlowLite engine. This provides several benefits:
1. **Abstraction**: The MCP server doesn't need to know how FlowLite parses YAML or manages internal step state.
2. **Governance Interception**: We inject compliance checks (Human-in-the-Loop) before the engine is even invoked.
3. **Auditability**: Every call through the adapter is automatically logged to the audit trail, ensuring zero "ghost actions".

## 🧱 Key Components

### 1. The MCP Protocol Layer (`src/server/`)
- Handles the JSON-RPC communication over Stdio.
- Translates MCP tool calls into standard TypeScript objects via Zod.
- Exposes the Tool Manifest to AI clients.

### 2. The Domain Adapter (`src/flowlite/`)
- Resolves workflow IDs to local file paths.
- Enforces `strictComplianceMode`.
- Manages the lifecycle of a "Run" (Start -> Log Trace -> Return Result).

### 3. Safety Utilities (`src/utils/`)
- Path Resolution: Ensures workflows cannot be loaded from outside the configured directory (preventing directory traversal).
- Stdio-Safe Logger: Uses Winston but ensures log output doesn't pollute the Stdio stream used by the MCP protocol.

## 🔄 Execution Flow
1. **AI client** (e.g., Claude) requests a tool call.
2. **MCP Server** validates inputs using Zod.
3. **Tool Handler** dispatches to the `FlowLiteAdapter`.
4. **Adapter** checks compliance rules:
   - If `highRisk` AND no approval token -> **Early Exit (Blocked)**.
   - If OK -> **Invoke FlowLite Engine**.
5. **Adapter** writes the result to a permanent Audit Trail file.
6. **MCP Server** envelopes the result with metadata and returns it to the AI.
