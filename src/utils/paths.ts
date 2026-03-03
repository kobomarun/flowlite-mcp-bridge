import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import logger from "./logger.js";

/**
 * Ensures that the required directories exist.
 * If they do not exist, they will be created recursively.
 */
export async function ensureDir(dirPath: string): Promise<string> {
  const absolutePath = path.isAbsolute(dirPath) ? dirPath : path.resolve(process.cwd(), dirPath);

  if (!existsSync(absolutePath)) {
    logger.info(`Creating directory: ${absolutePath}`);
    await fs.mkdir(absolutePath, { recursive: true });
  }

  return absolutePath;
}

/**
 * Resolves a workflow ID to its corresponding YAML file path.
 */
export function getWorkflowPath(workflowsDir: string, workflowId: string): string {
  // Simple validation to prevent path traversal
  if (workflowId.includes("..") || workflowId.includes("/") || workflowId.includes("\\")) {
    throw new Error(`Invalid workflow ID: ${workflowId}`);
  }

  return path.join(workflowsDir, `${workflowId}.yml`);
}

/**
 * Gets the path for a run trace manifest.
 */
export function getTraceManifestPath(dataDir: string, runId: string): string {
  return path.join(dataDir, `run_${runId}.json`);
}
