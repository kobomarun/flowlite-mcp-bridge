/**
 * @module server/types
 *
 * MCP protocol-layer types: tool input/output contracts, server configuration,
 * and response metadata. These types form the public API surface that an AI
 * client (e.g. Claude, GPT-4o) calls through the Model Context Protocol.
 *
 * Design principle: Every tool input schema is a Zod object so it can be
 * serialised to JSON Schema for the tool-manifest and validated at runtime.
 *
 * Strict typing: `any` is BANNED. Use `z.unknown()` or a generic parameter
 * wherever the shape is legitimately dynamic.
 */

import { z } from "zod";
import type {
  ComplianceFlags,
  AuditEntry,
  ParsedMessage,
  WorkflowRunResult,
  AuditTrail,
} from "../flowlite/types.js";

// ─────────────────────────────────────────────────────────────────────────────
// § 1. SERVER CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validated configuration supplied to the MCP server at startup.
 * All paths are validated as non-empty strings; further FS validation
 * happens in the adapter layer at first use.
 */
export const ServerConfigSchema = z.object({
  /**
   * Directory where FlowLite workflow YAML files live.
   * The adapter scans this directory to resolve workflow IDs.
   */
  workflowsDir: z.string().min(1, "workflowsDir must be a non-empty path"),

  /**
   * Directory where audit manifests and compliance trace files are written.
   * Each completed workflow run produces one JSON file here.
   */
  dataDir: z.string().min(1, "dataDir must be a non-empty path"),

  /**
   * Human-readable name surfaced in the MCP server info response.
   * @default "FlowLite MCP Bridge"
   */
  serverName: z.string().default("FlowLite MCP Bridge"),

  /**
   * Semantic version of this server deployment.
   * @default "0.1.0"
   */
  serverVersion: z.string().default("0.1.0"),

  /**
   * Log level forwarded to the Winston logger.
   * @default "info"
   */
  logLevel: z.enum(["error", "warn", "info", "http", "verbose", "debug", "silly"]).default("info"),

  /**
   * When true, compliance violations block execution and return a 4xx-style
   * error instead of a warning. Use for production / regulated environments.
   * @default false
   */
  strictComplianceMode: z.boolean().default(false),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// § 2. SHARED RESPONSE ENVELOPE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Human-in-the-Loop notification embedded in the response metadata.
 * The AI client MUST surface this to the user before confirming further
 * execution when `required` is true.
 */
export interface HumanInTheLoopNotification {
  required: boolean;
  reason: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  approvalToken?: string; // opaque token the client sends back to grant approval
}

/**
 * Metadata block attached to every MCP tool response.
 * Carries governance information that the AI client should surface or log
 * without modifying the primary `result` payload.
 */
export interface ResponseMetadata {
  requestId: string;
  toolName: string;
  serverVersion: string;
  processedAt: string; // ISO-8601
  durationMs: number;
  humanInTheLoop?: HumanInTheLoopNotification;
  complianceFlags?: ComplianceFlags;
  auditEntries?: AuditEntry[];
  warnings?: string[];
}

/**
 * Standard envelope wrapping every tool response.
 *
 * @typeParam T - The shape of the primary result payload for this tool.
 */
export interface McpToolResponse<T> {
  success: boolean;
  result: T;
  metadata: ResponseMetadata;
  error?: McpErrorPayload;
}

/**
 * Structured error payload returned when `success` is false.
 * Mirrors the FlowLiteError class properties so clients can handle
 * domain errors programmatically.
 */
export interface McpErrorPayload {
  code: McpErrorCode;
  message: string;
  workflowId?: string;
  stepId?: string;
  details?: Record<string, unknown>;
}

/**
 * Discriminated error codes for all failure modes the bridge can produce.
 * Clients should switch on these codes rather than parsing error messages.
 */
export type McpErrorCode =
  | "WORKFLOW_NOT_FOUND"
  | "WORKFLOW_PARSE_ERROR"
  | "WORKFLOW_EXECUTION_FAILED"
  | "STEP_EXECUTION_FAILED"
  | "COMPLIANCE_VIOLATION"
  | "HUMAN_APPROVAL_REQUIRED"
  | "AUDIT_WRITE_FAILED"
  | "RUN_NOT_FOUND"
  | "INVALID_INPUT"
  | "SERVER_ERROR";

// ─────────────────────────────────────────────────────────────────────────────
// § 3. TOOL: flowlite.parseMessage
// ─────────────────────────────────────────────────────────────────────────────

export const ParseMessageInputSchema = z.object({
  /**
   * The raw natural-language text that should be parsed into a structured intent.
   */
  message: z.string().min(1, "message must not be empty"),

  /**
   * Optional BCP-47 locale hint to improve NLU accuracy.
   * @example "en-US", "fr-FR"
   */
  locale: z.string().optional(),

  /**
   * Contextual hint scoped to a list of workflow IDs to bias intent matching.
   * When provided, the NLU will rank intents that map to these workflows higher.
   */
  workflowScope: z.array(z.string()).optional(),
});

export type ParseMessageInput = z.infer<typeof ParseMessageInputSchema>;

export type ParseMessageOutput = McpToolResponse<ParsedMessage>;

// ─────────────────────────────────────────────────────────────────────────────
// § 4. TOOL: flowlite.runWorkflow
// ─────────────────────────────────────────────────────────────────────────────

export const RunWorkflowInputSchema = z.object({
  /**
   * The ID of the FlowLite workflow to execute.
   * Must match the `id` field in the workflow YAML.
   */
  workflowId: z.string().min(1, "workflowId must not be empty"),

  /**
   * Key-value pairs injected as workflow inputs.
   * The adapter validates these against the workflow's declared input schema.
   */
  inputs: z.record(z.string(), z.unknown()).optional(),

  /**
   * When true, the caller has pre-approved any human-in-the-loop gates.
   * The bridge records this assertion in the audit trail.
   * @default false
   */
  humanApprovalGranted: z.boolean().default(false),

  /**
   * Opaque token returned in a prior `humanInTheLoop.approvalToken` field.
   * Must be present when re-submitting a blocked run after human approval.
   */
  approvalToken: z.string().optional(),
});

export type RunWorkflowInput = z.infer<typeof RunWorkflowInputSchema>;

export type RunWorkflowOutput = McpToolResponse<WorkflowRunResult>;

// ─────────────────────────────────────────────────────────────────────────────
// § 5. TOOL: flowlite.replayRun
// ─────────────────────────────────────────────────────────────────────────────

export const ReplayRunInputSchema = z.object({
  /**
   * The `runId` of a previously completed or failed workflow run to replay.
   */
  runId: z.string().min(1, "runId must not be empty"),

  /**
   * Input overrides applied on top of the original run's inputs.
   * Useful for replaying with corrected parameters after a step failure.
   */
  inputOverrides: z.record(z.string(), z.unknown()).optional(),

  /**
   * When specified, replay starts from this step index (0-based) instead of
   * the beginning. Steps before this index are treated as already completed
   * with their original outputs.
   */
  fromStepIndex: z.number().int().nonnegative().optional(),
});

export type ReplayRunInput = z.infer<typeof ReplayRunInputSchema>;

export type ReplayRunOutput = McpToolResponse<WorkflowRunResult>;

// ─────────────────────────────────────────────────────────────────────────────
// § 6. TOOL: flowlite.getAuditTrail  [ENHANCEMENT]
// ─────────────────────────────────────────────────────────────────────────────

export const GetAuditTrailInputSchema = z.object({
  /**
   * Retrieve the full audit trail for a specific run.
   * Mutually exclusive with `workflowId` range queries.
   */
  runId: z.string().optional(),

  /**
   * Filter audit entries for all runs of a specific workflow.
   */
  workflowId: z.string().optional(),

  /**
   * Inclusive lower bound for filtering by event timestamp (ISO-8601).
   */
  fromDate: z.string().datetime().optional(),

  /**
   * Inclusive upper bound for filtering by event timestamp (ISO-8601).
   */
  toDate: z.string().datetime().optional(),

  /**
   * Maximum number of audit entries to return.
   * @default 100
   */
  limit: z.number().int().positive().max(1000).default(100),
});

export type GetAuditTrailInput = z.infer<typeof GetAuditTrailInputSchema>;

export type GetAuditTrailOutput = McpToolResponse<AuditTrail[]>;

// ─────────────────────────────────────────────────────────────────────────────
// § 7. TOOL REGISTRY  (union discriminant for the handler router)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Discriminated union of all supported MCP tool names.
 * The handler router switches on this type to dispatch to the correct handler.
 */
export type McpToolName =
  | "flowlite.parseMessage"
  | "flowlite.runWorkflow"
  | "flowlite.replayRun"
  | "flowlite.getAuditTrail";

/**
 * Map of tool name → { input, output } type pairs.
 * Consumed by the tool manifest builder and handler type guards.
 */
export interface McpToolTypeMap {
  "flowlite.parseMessage": {
    input: ParseMessageInput;
    output: ParseMessageOutput;
  };
  "flowlite.runWorkflow": {
    input: RunWorkflowInput;
    output: RunWorkflowOutput;
  };
  "flowlite.replayRun": {
    input: ReplayRunInput;
    output: ReplayRunOutput;
  };
  "flowlite.getAuditTrail": {
    input: GetAuditTrailInput;
    output: GetAuditTrailOutput;
  };
}
