declare module "flowlite" {
  export const LogLevel: Record<string, number>;
  export const ParamType: Record<string, string>;
  export const param: (name: string, type: string, description: string, optional?: boolean) => object;
  export const goto: (nodeId: string) => object;
  export const apiKey: (name: string, description: string, required?: boolean) => object;
  export const createTool: (fn: (input: Record<string, unknown>) => Promise<unknown>, metadata?: Record<string, unknown>) => Tool;

  export class Tool {
    metadata: Record<string, unknown>;
    call(input: Record<string, unknown>): Promise<unknown>;
    execute(input: Record<string, unknown>): Promise<unknown>;
  }

  export class LLMTool extends Tool { }
  export class APITool extends Tool { }

  export class Node {
    fn: Tool | ((input: unknown) => Promise<unknown>);
    next(fnOrTool: Tool | ((input: unknown) => Promise<unknown>), options?: Record<string, unknown>): Flow;
  }

  export class Flow {
    static start(fnOrTool: Tool | ((input: unknown) => Promise<unknown>), metadata?: Record<string, unknown>): Flow;
    next(fnOrTool: Tool | ((input: unknown) => Promise<unknown>), options?: Record<string, unknown>): Flow;
    run(input?: Record<string, unknown>): Promise<unknown>;
  }
}
