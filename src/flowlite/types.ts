/**
 * @module flowlite/types
 *
 * Core domain types for FlowLite workflow definitions and execution results.
 * These types model the FlowLite YAML schema and runtime state so that the
 * adapter layer can interact with the FlowLite engine in a fully type-safe way.
 *
 * Design principle: ALL fields use strict Zod schemas so that any payload
 * received from an AI client is validated at the boundary before touching
 * business logic.
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// § 1. PRIMITIVE SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A non-empty string for identifiers (step IDs, workflow names, etc.).
 * Prevents blank strings from silently slipping through as valid IDs.
 */
export const NonEmptyStringSchema = z.string().min(1, "Value must not be empty");

/**
 * ISO-8601 datetime string produced by `new Date().toISOString()`.
 */
export const ISODateTimeSchema = z
  .string()
  .datetime({ message: "Must be a valid ISO-8601 datetime string" });

// ─────────────────────────────────────────────────────────────────────────────
// § 2. WORKFLOW DEFINITION SCHEMAS  (mirrors the FlowLite YAML DSL)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compliance flags attached to any workflow or individual step.
 * When `requiresHumanApproval` is true the MCP server MUST surface a
 * human-in-the-loop notification in the response metadata before executing.
 */
export const ComplianceFlagsSchema = z.object({
  requiresHumanApproval: z.boolean().default(false),
  highRisk: z.boolean().default(false),
  dataClassification: z
    .enum(["public", "internal", "confidential", "restricted"])
    .default("internal"),
  auditRequired: z.boolean().default(true),
  retentionDays: z.number().int().positive().optional(),
});

export type ComplianceFlags = z.infer<typeof ComplianceFlagsSchema>;

/**
 * A single step within a FlowLite workflow definition.
 * Maps directly to the `steps[].action` block in the YAML DSL.
 */
export const WorkflowStepSchema = z.object({
  id: NonEmptyStringSchema,
  action: NonEmptyStringSchema,
  description: z.string().optional(),
  input: z.record(z.string(), z.unknown()).optional(),
  output: z.record(z.string(), z.unknown()).optional(),
  compliance: ComplianceFlagsSchema.optional(),
  dependsOn: z.array(NonEmptyStringSchema).optional(),
  timeout: z.number().int().positive().optional(),
  retryPolicy: z
    .object({
      maxAttempts: z.number().int().min(1).max(10),
      backoffMs: z.number().int().positive().default(1000),
    })
    .optional(),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

/**
 * A fully-parsed FlowLite workflow definition loaded from a YAML file.
 * The `compliance` field at the root level provides defaults that are
 * inherited by every step unless overridden at the step level.
 */
export const WorkflowDefinitionSchema = z.object({
  id: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Must follow semver (e.g. 1.0.0)"),
  description: z.string().optional(),
  compliance: ComplianceFlagsSchema,
  steps: z.array(WorkflowStepSchema).min(1, "A workflow must contain at least one step"),
  inputs: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  createdAt: ISODateTimeSchema.optional(),
  updatedAt: ISODateTimeSchema.optional(),
});

export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// § 3. MESSAGE / NLU SCHEMAS  (parsed intent from AI natural language)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * An entity extracted from a natural-language message by FlowLite's NLU engine.
 */
export const ExtractedEntitySchema = z.object({
  name: NonEmptyStringSchema,
  value: z.unknown(),
  confidence: z.number().min(0).max(1),
});

export type ExtractedEntity = z.infer<typeof ExtractedEntitySchema>;

/**
 * The structured output of `flowlite.parseMessage`.
 * Represents the NLU parse result from a raw user/system text message.
 */
export const ParsedMessageSchema = z.object({
  rawText: NonEmptyStringSchema,
  intent: NonEmptyStringSchema,
  confidence: z.number().min(0).max(1),
  entities: z.array(ExtractedEntitySchema),
  suggestedWorkflowId: z.string().optional(),
  locale: z.string().default("en"),
  parsedAt: ISODateTimeSchema,
});

export type ParsedMessage = z.infer<typeof ParsedMessageSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// § 4. EXECUTION SCHEMAS  (runtime state while a workflow is running)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The outcome of a single step that has been executed.
 */
export const StepResultSchema = z.object({
  stepId: NonEmptyStringSchema,
  status: z.enum(["pending", "running", "success", "failed", "skipped"]),
  output: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
  startedAt: ISODateTimeSchema,
  completedAt: ISODateTimeSchema.optional(),
  durationMs: z.number().int().nonnegative().optional(),
  attempt: z.number().int().min(1).default(1),
});

export type StepResult = z.infer<typeof StepResultSchema>;

/**
 * The overall execution result produced by `flowlite.runWorkflow`.
 * `traceManifestPath` records where the compliance audit manifest was written
 * on disk so the caller can reference it later in `flowlite.getAuditTrail`.
 */
export const WorkflowRunResultSchema = z.object({
  runId: NonEmptyStringSchema,
  workflowId: NonEmptyStringSchema,
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
  steps: z.array(StepResultSchema),
  inputs: z.record(z.string(), z.unknown()).optional(),
  outputs: z.record(z.string(), z.unknown()).optional(),
  triggeredAt: ISODateTimeSchema,
  completedAt: ISODateTimeSchema.optional(),
  totalDurationMs: z.number().int().nonnegative().optional(),
  traceManifestPath: z.string().optional(),
  complianceSummary: ComplianceFlagsSchema.optional(),
});

export type WorkflowRunResult = z.infer<typeof WorkflowRunResultSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// § 5. AUDIT TRAIL SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single entry in the compliance/audit log.
 * Written once per workflow run and once per high-risk step.
 */
export const AuditEntrySchema = z.object({
  entryId: NonEmptyStringSchema,
  runId: NonEmptyStringSchema,
  workflowId: NonEmptyStringSchema,
  stepId: z.string().optional(),
  event: z.enum([
    "workflow_started",
    "step_started",
    "step_completed",
    "step_failed",
    "workflow_completed",
    "workflow_failed",
    "human_approval_required",
    "human_approval_granted",
    "human_approval_denied",
    "compliance_violation",
  ]),
  payload: z.record(z.string(), z.unknown()).optional(),
  timestamp: ISODateTimeSchema,
  actor: z.string().optional(),
});

export type AuditEntry = z.infer<typeof AuditEntrySchema>;

/**
 * The full audit trail for a workflow run — written as a JSON manifest to the
 * `--data-dir` so it survives process restarts and can be queried later.
 */
export const AuditTrailSchema = z.object({
  runId: NonEmptyStringSchema,
  workflowId: NonEmptyStringSchema,
  workflowName: NonEmptyStringSchema,
  startedAt: ISODateTimeSchema,
  completedAt: ISODateTimeSchema.optional(),
  entries: z.array(AuditEntrySchema),
  finalStatus: z.enum(["completed", "failed", "cancelled"]).optional(),
  complianceFlags: ComplianceFlagsSchema,
});

export type AuditTrail = z.infer<typeof AuditTrailSchema>;
