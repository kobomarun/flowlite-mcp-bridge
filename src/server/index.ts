import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { FlowLiteAdapter } from "../flowlite/adapter.js";
import { ToolHandlers } from "./handlers.js";
import { TOOL_MANIFEST } from "./manifest.js";
import type { ServerConfig } from "./types.js";
import logger from "../utils/logger.js";

/**
 * The core MCP Server implementation.
 * Wraps the @modelcontextprotocol/sdk and exposes FlowLite tools via Stdio.
 */
export class FlowLiteMcpServer {
  private server: Server;
  private adapter: FlowLiteAdapter;
  private handlers: ToolHandlers;

  constructor(private config: ServerConfig) {
    this.server = new Server(
      { name: config.serverName, version: config.serverVersion },
      { capabilities: { tools: {} } }
    );

    this.adapter = new FlowLiteAdapter({
      workflowsDir: config.workflowsDir,
      dataDir: config.dataDir,
      strictComplianceMode: config.strictComplianceMode,
    });

    this.handlers = new ToolHandlers(this.adapter, config.serverVersion);

    this.setupHandlers();
  }

  /**
   * Initializes the server and starts listening on Stdio.
   */
  async run() {
    logger.info(`Starting MCP Server: ${this.config.serverName} v${this.config.serverVersion}`);

    await this.adapter.initialize();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    logger.info("Server connected and listening on stdin/stdout");
  }

  /**
   * Registers MCP protocol handlers.
   */
  private setupHandlers() {
    // 1. List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOL_MANIFEST,
    }));

    // 2. Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      logger.debug(`Incoming tool call: ${name}`);
      const response = await this.handlers.handle(name, args);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2),
          },
        ],
        // The MCP SDK supports 'isError' at the transport level
        isError: !response.success,
      };
    });

    // Error logging
    this.server.onerror = (error) => {
      logger.error(`[MCP Error] ${error}`);
    };
  }
}
