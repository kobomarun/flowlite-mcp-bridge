/**
 * Flowlite - A minimal, elegant flow-based framework for AI agents
 * Inspired by functional programming and modern ES6+ features
 */

// Enum for log levels
export const LogLevel = { NONE: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4, TRACE: 5 };

// Parameter type definitions
export const ParamType = { STRING: 'string', NUMBER: 'number', BOOLEAN: 'boolean', OBJECT: 'object', ARRAY: 'array', ANY: 'any' };

// Helper for creating parameter definitions
export const param = (name, type, description, optional = false) => ({ name, type, description, optional });

// Helper for creating goto instructions
export const goto = (nodeId) => ({ _goto: nodeId });

// Helper for defining API keys
export const apiKey = (name, description, required = true) => ({ name, description, required });

// Base Tool class - all tools inherit from this
export class Tool {
  constructor(metadata = {}) {
    this.metadata = {
      name: metadata.name || 'unnamed_tool',
      description: metadata.description || 'No description provided',
      input: metadata.input || [],
      output: metadata.output || [],
      examples: metadata.examples || [],
      apiKeys: metadata.apiKeys || [],
      tags: metadata.tags || []
    };
    this.stats = { calls: 0, errors: 0, totalTime: 0 };
    this.logLevel = metadata.logLevel || LogLevel.INFO;
    this.logger = metadata.logger || console;
    this.startTime = 0;
  }

  // Chainable configuration methods
  setLogLevel = (level) => { this.logLevel = level; return this; };
  setLogger = (logger) => { this.logger = logger; return this; };
  withApiKey = (name, description, required = true) => { 
    this.metadata.apiKeys.push(apiKey(name, description, required)); 
    return this; 
  };
  withExample = (input, output) => { 
    this.metadata.examples.push({ input, output }); 
    return this; 
  };
  withTag = (tag) => { 
    this.metadata.tags.push(tag); 
    return this; 
  };

  // Logging methods
  log = (message, ...args) => this.logger.log(message, ...args);
  error = (message, ...args) => this.logLevel >= LogLevel.ERROR && this.logger.error(message, ...args);
  warn = (message, ...args) => this.logLevel >= LogLevel.WARN && this.logger.warn(message, ...args);
  info = (message, ...args) => this.logLevel >= LogLevel.INFO && this.logger.info(message, ...args);
  debug = (message, ...args) => this.logLevel >= LogLevel.DEBUG && this.logger.debug(message, ...args);
  trace = (message, ...args) => this.logLevel >= LogLevel.TRACE && this.logger.trace(message, ...args);

  // Statistics methods
  getStats = () => ({ 
    ...this.stats, 
    avgTime: this.stats.calls ? this.stats.totalTime / this.stats.calls : 0,
    errorRate: this.stats.calls ? this.stats.errors / this.stats.calls : 0
  });
  resetStats = () => { this.stats = { calls: 0, errors: 0, totalTime: 0 }; return this; };

  // Core execution method - must be implemented by subclasses
  async execute(input) { throw new Error('Tool.execute() must be implemented by subclass'); }

  // Call method - handles statistics and logging
  async call(input) {
    this.stats.calls++;
    this.startTime = performance.now();
    
    try {
      this.debug(`[${this.metadata.name}] Executing with input:`, input);
      const result = await this.execute(input);
      const duration = performance.now() - this.startTime;
      this.stats.totalTime += duration;
      this.debug(`[${this.metadata.name}] Completed in ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      this.stats.errors++;
      this.error(`[${this.metadata.name}] Error:`, error);
      throw error;
    }
  }

  // Convert tool to a function with metadata
  asFunction() {
    const fn = async input => await this.call(input);
    fn.metadata = this.metadata;
    return fn;
  }
}

// LLM Tool class - specialized for LLM interactions
export class LLMTool extends Tool {
  constructor(metadata = {}) {
    super({
      ...metadata,
      apiKeys: [...(metadata.apiKeys || []), apiKey('OPENAI_API_KEY', 'OpenAI API Key')]
    });
  }

  async execute(input) {
    // Validate API keys
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required for LLM tools');
    }
    
    // Process the prompt and call the LLM API
    const prompt = typeof input === 'string' ? input : input.prompt;
    // This would be replaced with actual API call in production
    return `Simulated LLM response for: ${prompt}`;
  }
}

// API Tool class - specialized for external API calls
export class APITool extends Tool {
  constructor(metadata = {}) {
    super(metadata);
    this.retries = metadata.retries || 1;
    this.retryDelay = metadata.retryDelay || 1000;
  }

  async execute(input) {
    const { url, options = {} } = input;
    let attempt = 0;
    let error;

    while (attempt <= this.retries) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          throw new Error(`API returned error status: ${response.status}`);
        }
        return await response.json();
      } catch (err) {
        error = err;
        attempt++;
        if (attempt <= this.retries) {
          this.warn(`[${this.metadata.name}] API call failed, retrying in ${this.retryDelay}ms (${attempt}/${this.retries}):`, err);
          await new Promise(r => setTimeout(r, this.retryDelay));
          this.retryDelay *= 2; // Exponential backoff
        }
      }
    }
    
    throw error;
  }
}

// Node class - represents a step in the flow
export class Node {
  constructor(fnOrTool, id, options = {}) {
    this.fn = fnOrTool;
    this.id = id || `node_${Math.random().toString(36).substring(2, 9)}`;
    this.name = options.name || (fnOrTool instanceof Tool ? fnOrTool.metadata.name : 
      (typeof fnOrTool === 'function' ? fnOrTool.name : 'unnamed_node'));
    this.outcomes = new Map();
    this.stats = { runs: 0, errors: 0, totalTime: 0 };
    this.maxRuns = options.maxRuns || Infinity;
    this.runCount = 0;
    this.logLevel = options.logLevel || LogLevel.INFO;
    this.logger = options.logger || console;
  }

  // Add a default next node
  next(nodeId) {
    this.outcomes.set('default', nodeId);
    return this;
  }

  // Add a conditional outcome
  on(outcome, nodeId) {
    this.outcomes.set(outcome, nodeId);
    return this;
  }

  // Set maximum runs for this node
  setMaxRuns(max) {
    this.maxRuns = max;
    return this;
  }

  // Execute the node function with the current state
  async run(state) {
    if (this.maxRuns > 0 && this.runCount >= this.maxRuns) {
      throw new Error(`max runs (${this.maxRuns})`);
    }
    
    this.stats.runs++;
    this.runCount++;
    const startTime = performance.now();
    
    try {
      // Handle different types of node functions
      let result;
      
      if (this.fn instanceof Tool) {
        result = await this.fn.call(state);
      } else if (typeof this.fn === 'function') {
        result = await this.fn(state);
      } else {
        result = this.fn;
      }
      
      const duration = performance.now() - startTime;
      this.stats.totalTime += duration;
      
      return result;
    } catch (error) {
      this.stats.errors++;
      throw error;
    }
  }
}

// Flow class - manages the execution of nodes
export class Flow {
  constructor(metadata = {}) {
    this.metadata = {
      name: metadata.name || 'unnamed_flow',
      description: metadata.description || '',
      input: metadata.input || [],
      output: metadata.output || []
    };
    
    this.nodes = new Map();
    this.startNodeId = null;
    this.lastNodeId = null;
    this.logLevel = metadata.logLevel || LogLevel.INFO;
    this.logger = metadata.logger || console;
    this.stats = { runs: 0, errors: 0, totalTime: 0, nodeStats: {} };
  }

  // Static factory methods
  static create(metadata = {}) {
    return new Flow(metadata);
  }

  static start(fnOrTool, options = {}) {
    return new Flow().next(fnOrTool, options);
  }

  // Logging methods
  log = (message, ...args) => this.logger.log(message, ...args);
  error = (message, ...args) => this.logLevel >= LogLevel.ERROR && this.logger.error(message, ...args);
  warn = (message, ...args) => this.logLevel >= LogLevel.WARN && this.logger.warn(message, ...args);
  info = (message, ...args) => this.logLevel >= LogLevel.INFO && this.logger.info(message, ...args);
  debug = (message, ...args) => this.logLevel >= LogLevel.DEBUG && this.logger.debug(message, ...args);
  trace = (message, ...args) => this.logLevel >= LogLevel.TRACE && this.logger.trace(message, ...args);

  // Statistics methods
  getStats = () => ({ 
    ...this.stats, 
    avgTime: this.stats.runs ? this.stats.totalTime / this.stats.runs : 0,
    errorRate: this.stats.runs ? this.stats.errors / this.stats.runs : 0
  });
  
  resetStats = () => {
    this.stats = { runs: 0, errors: 0, totalTime: 0, nodeStats: {} };
    return this;
  };

  // Configuration methods
  setLogLevel = (level) => { this.logLevel = level; return this; };
  setLogger = (logger) => { this.logger = logger; return this; };

  // Add a node to the flow
  next(nodeOrFn, options = {}) {
    const node = this.createNode(nodeOrFn, options);
    
    if (!this.startNodeId) {
      this.startNodeId = node.id;
    } else {
      const prevNode = this.nodes.get(this.lastNodeId);
      if (prevNode) {
        prevNode.next(node.id);
      }
    }
    
    this.lastNodeId = node.id;
    return this;
  }

  // Add conditional branch based on outcome
  on(outcome, nodeOrFn, options = {}) {
    const lastNode = this.nodes.get(this.lastNodeId);
    if (!lastNode) {
      throw new Error('No node to add outcome to');
    }
    
    const node = this.createNode(nodeOrFn, options);
    lastNode.on(outcome, node.id);
    
    return this;
  }

  // Add parallel execution of multiple nodes
  all(nodesOrFns, options = {}) {
    const mergeOption = options.merge === undefined ? true : options.merge;
    
    const parallelFn = async (state) => {
      const results = await Promise.all(
        nodesOrFns.map(async (nodeOrFn) => {
          if (typeof nodeOrFn === 'function') {
            return await nodeOrFn(state);
          } else if (nodeOrFn instanceof Tool) {
            return await nodeOrFn.call(state);
          } else if (nodeOrFn instanceof Node) {
            return await nodeOrFn.run(state);
          }
          return nodeOrFn;
        })
      );
      
      if (mergeOption) {
        return results.reduce((acc, result) => ({ ...acc, ...result }), { ...state });
      } else {
        return { ...state, results };
      }
    };
    
    return this.next(parallelFn, { 
      name: options.name || 'parallel', 
      ...options 
    });
  }

  // Convert flow to a Tool instance
  asTool(options = {}) {
    const flowTool = new Tool({
      name: options.name || this.metadata.name,
      description: options.description || this.metadata.description,
      input: options.input || this.metadata.input,
      output: options.output || this.metadata.output,
      ...options
    });
    
    flowTool.execute = async (input) => {
      return await this.run(input);
    };
    
    return flowTool;
  }

  // Execute the flow with the given initial state
  async run(initialState = {}) {
    this.info(`[${this.metadata.name}] Starting flow execution`);
    this.stats.runs++;
    
    if (!this.startNodeId) {
      throw new Error('Flow has no start node');
    }
    
    let state = { ...initialState };
    let currentNodeId = this.startNodeId;
    let steps = 0;
    const startTime = performance.now();
    
    while (currentNodeId) {
      steps++;
      const currentNode = this.nodes.get(currentNodeId);
      
      if (!currentNode) {
        throw new Error(`Node not found: ${currentNodeId}`);
      }
      
      let nextNodeId = null;
      
      try {
        this.debug(`[${this.metadata.name}] Executing node: ${currentNode.name} (${currentNodeId})`);
        
        if (!this.stats.nodeStats[currentNodeId]) {
          this.stats.nodeStats[currentNodeId] = { 
            name: currentNode.name,
            calls: 0, 
            errors: 0, 
            totalTime: 0 
          };
        }
        
        const nodeStats = this.stats.nodeStats[currentNodeId];
        nodeStats.calls++;
        
        const nodeStartTime = performance.now();
        const result = await currentNode.run(state);
        const nodeDuration = performance.now() - nodeStartTime;
        
        nodeStats.totalTime += nodeDuration;
        this.debug(`[${this.metadata.name}] Node ${currentNode.name} completed in ${nodeDuration.toFixed(2)}ms`);
        
        // Handle goto instructions
        if (result && typeof result === 'object' && result._goto) {
          nextNodeId = result._goto;
          this.debug(`[${this.metadata.name}] Goto instruction: ${nextNodeId}`);
        } 
        // Handle outcome-based routing
        else if (result && currentNode.outcomes.has(result)) {
          nextNodeId = currentNode.outcomes.get(result);
          this.debug(`[${this.metadata.name}] Following outcome: ${result} -> ${nextNodeId}`);
        }
        // Default to next node
        else if (currentNode.outcomes.has('default')) {
          nextNodeId = currentNode.outcomes.get('default');
          this.debug(`[${this.metadata.name}] Following default outcome -> ${nextNodeId}`);
        }
        
        // Update state with result if it's an object
        if (result && typeof result === 'object' && !result._goto) {
          state = { ...state, ...result };
        }
        
        currentNodeId = nextNodeId;
      } catch (error) {
        if (this.stats.nodeStats[currentNodeId]) {
          this.stats.nodeStats[currentNodeId].errors++;
        }
        this.error(`[${this.metadata.name}] Error in node ${currentNode.name} (${currentNodeId}):`, error);
        throw error;
      }
    }
    
    const duration = performance.now() - startTime;
    this.stats.totalTime += duration;
    
    this.info(`[${this.metadata.name}] Flow completed in ${isNaN(duration) ? 'unknown' : duration.toFixed(2)}ms after ${steps} steps`);
    this.debug(`[${this.metadata.name}] Final state:`, state);
    
    return state;
  }
  
  createNode(nodeOrFn, options = {}) {
    const node = nodeOrFn instanceof Node 
      ? nodeOrFn 
      : new Node(nodeOrFn, options.id, options);
    
    this.nodes.set(node.id, node);
    
    return node;
  }
}

// Utility for creating a Tool from a function
export const createTool = (fn, metadata = {}) => {
  const tool = new Tool(metadata);
  tool.execute = fn;
  return tool;
};

// Map-reduce utility for processing collections
export const mapReduce = (items, mapFn, reduceFn = null, options = {}) => {
  const { concurrency = Infinity } = options;
  
  return async (state) => {
    // Process items in batches if concurrency is limited
    const processItems = async () => {
      if (concurrency === Infinity) {
        return await Promise.all(items.map(item => mapFn(item, state)));
      }
      
      const results = [];
      for (let i = 0; i < items.length; i += concurrency) {
        const batch = items.slice(i, i + concurrency);
        const batchResults = await Promise.all(batch.map(item => mapFn(item, state)));
        results.push(...batchResults);
      }
      return results;
    };
    
    const mappedResults = await processItems();
    
    // Apply reducer function if provided
    if (reduceFn) {
      return await reduceFn(mappedResults, state);
    }
    
    return mappedResults;
  };
};
