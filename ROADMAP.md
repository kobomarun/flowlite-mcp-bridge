# 🗺️ FlowLite-MCP Bridge Roadmap

This roadmap outlines the planned evolution of the bridge as we move toward a 1.0.0 stable release and beyond.

## 🚀 Phase 1: Foundation (COMPLETED)
- [x] Core MCP Protocol implementation
- [x] Zod-based schema validation for all tool inputs
- [x] FlowLite Adapter layer with human-in-the-loop (HITL) triggers
- [x] Local audit trail logging (JSON artifacts)
- [x] Interactive CLI for easy server startup

## 🛠️ Phase 2: Enhanced Orchestration (Current Focus)
- [ ] **Multi-Step Traceability**: Deeper integration with FlowLite's internal step-level logs.
- [ ] **Database Persistence**: Optional adapter for PostgreSQL/SQLite to store audit trails at scale.
- [ ] **Dynamic Workflow Discovery**: Watcher service to reload workflows without restarting the MCP server.
- [ ] **Tool Call Batching**: Support for replaying multiple steps in a single tool invocation.

## 🏛️ Phase 3: Enterprise Features
- [ ] **OAuth2 Integration**: Secure tool execution tied to authenticated user identities.
- [ ] **Workflow Visualizer**: Web-based dashboard to view real-time audit trails and HITL status.
- [ ] **AI-driven Suggestions**: NLU improvements to suggest the "best-fit" workflow for a given natural language prompt.
- [ ] **Cloud Adapters**: Templates for deploying the bridge to AWS Lambda or Google Cloud Run.

## 🌍 Phase 4: Community & Ecosystem
- [ ] **Official MCP Registry Listing**: Inclusion in the primary MCP server repositories.
- [ ] **Marketplace Integration**: Pre-built workflow templates for common SaaS tools (Slack, HubSpot, Stripe).
- [ ] **SDK for custom adapters**: Allow developers to easily plug in their own domain logic while keeping our governance layer.
