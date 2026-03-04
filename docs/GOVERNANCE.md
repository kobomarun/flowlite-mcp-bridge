# Governance & Safety Model

The FlowLite-MCP Bridge treats safety as a **first-class citizen**, not an afterthought. This document explains every aspect of how we ensure AI agents cannot take unintended, harmful, or unaudited actions.

## 🔐 Principle 1: Human-in-the-Loop (HITL)

Any workflow marked with `requiresHumanApproval: true` in its YAML **will be blocked** from execution until a human explicitly grants approval.

### How it works:
1. Claude (or any AI) calls `flowlite.runWorkflow` with `humanApprovalGranted: false`.
2. The bridge identifies the `requiresHumanApproval` flag in the workflow YAML.
3. The bridge returns a `HUMAN_APPROVAL_REQUIRED` error **before any action is taken**.
4. The AI is expected to inform the human user and pause.
5. The human re-submits the call with `humanApprovalGranted: true`.
6. Only then does the workflow execute.

### Why this matters:
AI models can be confident but wrong. For high-value operations (payments, data deletion, deployments), this gate means **a human is always in control of the final action**.

---

## 📋 Principle 2: Audit Trails

For every single workflow run—successful or failed—a JSON trace manifest is persisted to the `--data-dir`.

### Audit Trail Format:
```json
{
  "runId": "run-...",
  "workflowId": "process-invoice",
  "workflowName": "Process Invoice Workflow",
  "startedAt": "2026-03-04T12:00:00.000Z",
  "completedAt": "2026-03-04T12:00:01.250Z",
  "status": "completed",
  "entries": [
    {
      "step": "validate-invoice",
      "status": "completed",
      "timestamp": "..."
    }
  ]
}
```

This creates a **non-repudiable log** — a permanent, human-readable record of what the AI did, when, and with what inputs.

---

## 🏷️ Principle 3: Data Classification

Every workflow YAML can declare a `dataClassification` level:

| Level | Description |
|---|---|
| `public` | Safe to log and display anywhere |
| `internal` | Internal teams only, not for external sharing |
| `confidential` | Encrypted at rest, restricted access |
| `restricted` | Highest protection. Requires HITL AND audit. |

The AI client receives this classification level in the response metadata and is expected to handle the data accordingly.
