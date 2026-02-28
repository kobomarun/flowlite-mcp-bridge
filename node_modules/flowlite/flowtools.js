/**
 * Flowlite Tools - A collection of useful tools and utilities for AI agent flows
 * Consolidates memory management, LLM integration, and data processing
 */

import { Tool, LLMTool, APITool, createTool, ParamType, param } from './flowlite.js';

// ======== Memory Management ========

/**
 * Creates a memory store for persisting data across flow executions
 */
export const createMemoryStore = () => {
  const store = new Map();
  
  const memoryTool = createTool(
    async (input) => {
      const { key, value, action = 'get' } = typeof input === 'string' ? { key: input } : input;
      
      switch (action) {
        case 'get':
          const storedValue = store.get(key);
          return storedValue !== undefined ? JSON.parse(JSON.stringify(storedValue)) : undefined;
        
        case 'set':
          store.set(key, JSON.parse(JSON.stringify(value)));
          return true;
        
        case 'delete':
          return store.delete(key);
        
        case 'clear':
          store.clear();
          return true;
        
        case 'keys':
          return Array.from(store.keys());
        
        case 'all':
          return Object.fromEntries(Array.from(store.entries()).map(
            ([k, v]) => [k, JSON.parse(JSON.stringify(v))]
          ));
        
        default:
          throw new Error(`Unknown memory action: ${action}`);
      }
    },
    {
      name: 'memory',
      description: 'Store and retrieve values from memory',
      input: [
        param('input', ParamType.ANY, 'Key string or object with key, value, and action')
      ],
      output: [
        param('result', ParamType.ANY, 'The stored value or operation result')
      ]
    }
  );
  
  return memoryTool;
};

// ======== LLM Integration ========

/**
 * Call an LLM with structured output parsing and validation
 */
export class LLMCallTool extends LLMTool {
  constructor(options = {}) {
    super({
      name: 'callLLM',
      description: 'Call an LLM with structured output parsing and validation',
      ...options
    });
    this.defaultModel = options.defaultModel || 'gpt-4';
    this.defaultTemperature = options.defaultTemperature || 0.7;
    this.defaultMaxTokens = options.defaultMaxTokens || 1000;
    this.defaultProvider = options.defaultProvider || 'openai';
  }
  
  async execute(input) {
    const { 
      prompt, 
      model = this.defaultModel, 
      temperature = this.defaultTemperature, 
      maxTokens = this.defaultMaxTokens,
      schema = null,
      retries = 3,
      validate = null,
      provider = this.defaultProvider
    } = typeof input === 'string' ? { prompt: input } : input;
    
    let attempt = 0;
    let error = null;
    
    while (attempt < retries) {
      try {
        // In a real implementation, this would call the appropriate provider API
        // This is a placeholder for actual API calls
        const response = await this.callLLMAPI(prompt, model, temperature, maxTokens, provider);
        
        // Parse response if schema is provided
        const parsedResponse = schema ? this.parseStructuredOutput(response, schema) : response;
        
        // Validate response if validation function is provided
        if (validate && !validate(parsedResponse)) {
          throw new Error('Response validation failed');
        }
        
        return parsedResponse;
      } catch (err) {
        error = err;
        attempt++;
        this.warn(`LLM call failed (attempt ${attempt}/${retries}): ${err.message}`);
        // Exponential backoff
        if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
    
    throw new Error(`LLM call failed after ${retries} attempts: ${error?.message}`);
  }
  
  async callLLMAPI(prompt, model, temperature, maxTokens, provider) {
    // This would be replaced with actual API call in production
    // For now, we'll simulate a response
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    return `This is a simulated response from ${provider} using model ${model}`;
  }
  
  parseStructuredOutput(text, schema) {
    // Try to extract JSON from the response
    try {
      // Try to extract JSON from text if it's embedded in other content
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || 
                        text.match(/```([\s\S]*?)```/) ||
                        text.match(/\{[\s\S]*\}/);
      
      const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text;
      return JSON.parse(jsonString);
    } catch (error) {
      throw new Error(`Failed to parse structured output: ${error.message}`);
    }
  }
}

/**
 * Create a prompt from a template and variables
 */
export const promptTemplate = createTool(
  (input) => {
    const { template, variables = {} } = typeof input === 'string' ? { template: input } : input;
    
    return Object.entries(variables).reduce(
      (prompt, [key, value]) => prompt.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value),
      template
    );
  },
  {
    name: 'promptTemplate',
    description: 'Create a prompt from a template and variables',
    input: [
      param('input', ParamType.ANY, 'Template string or object with template and variables')
    ],
    output: [
      param('result', ParamType.STRING, 'The filled template with variables replaced')
    ]
  }
);

// ======== Data Processing ========

/**
 * Parse JSON from text with error handling
 */
export const jsonParser = createTool(
  (input) => {
    const { text, fallback = {} } = typeof input === 'string' ? { text: input } : input;
    
    try {
      // Try to extract JSON from text if it's embedded in other content
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || 
                        text.match(/```([\s\S]*?)```/) ||
                        text.match(/\{[\s\S]*\}/);
      
      const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text;
      return JSON.parse(jsonString);
    } catch (error) {
      return fallback;
    }
  },
  {
    name: 'jsonParser',
    description: 'Extract and parse JSON from text, with fallback for errors',
    input: [
      param('input', ParamType.ANY, 'Text string or object with text and fallback')
    ],
    output: [
      param('result', ParamType.OBJECT, 'The parsed JSON object or fallback value')
    ]
  }
);

/**
 * Split text into chunks for processing
 */
export const textChunker = createTool(
  (input) => {
    const { text, maxChunkSize = 1000, overlap = 200 } = typeof input === 'string' 
      ? { text: input } 
      : input;
    
    if (!text || text.length <= maxChunkSize) return [text];
    
    const chunks = [];
    let position = 0;
    
    while (position < text.length) {
      let chunkEnd = Math.min(position + maxChunkSize, text.length);
      
      // Try to end at a sentence or paragraph boundary if possible
      if (chunkEnd < text.length) {
        const nextPeriod = text.indexOf('.', chunkEnd - 100);
        const nextNewline = text.indexOf('\n', chunkEnd - 100);
        
        if (nextPeriod !== -1 && nextPeriod < chunkEnd + 100) {
          chunkEnd = nextPeriod + 1;
        } else if (nextNewline !== -1 && nextNewline < chunkEnd + 100) {
          chunkEnd = nextNewline + 1;
        }
      }
      
      chunks.push(text.substring(position, chunkEnd));
      position = chunkEnd - overlap;
    }
    
    return chunks;
  },
  {
    name: 'textChunker',
    description: 'Split text into overlapping chunks for processing',
    input: [
      param('input', ParamType.ANY, 'Text string or object with text and options')
    ],
    output: [
      param('chunks', ParamType.ARRAY, 'Array of text chunks with overlap')
    ]
  }
);

/**
 * Create a deep copy snapshot of an object
 */
export const stateSnapshot = createTool(
  (state) => JSON.parse(JSON.stringify(state)),
  {
    name: 'stateSnapshot',
    description: 'Create a deep copy snapshot of the current state',
    input: [
      param('state', ParamType.OBJECT, 'The state object to snapshot')
    ],
    output: [
      param('snapshot', ParamType.OBJECT, 'A deep copy of the state object')
    ]
  }
);

// ======== Web and API Tools ========

/**
 * Fetch data from a URL
 */
export class WebFetchTool extends APITool {
  constructor(options = {}) {
    super({
      name: 'webFetch',
      description: 'Fetch data from a URL with retry capability',
      ...options
    });
  }
  
  async execute(input) {
    const { url, method = 'GET', headers = {}, body = null, responseType = 'json' } = 
      typeof input === 'string' ? { url: input } : input;
    
    const options = {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      ...(body ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {})
    };
    
    let attempt = 0;
    let error;
    
    while (attempt <= this.retries) {
      try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
          throw new Error(`API returned error status: ${response.status}`);
        }
        
        switch (responseType) {
          case 'json': return await response.json();
          case 'text': return await response.text();
          case 'blob': return await response.blob();
          case 'arrayBuffer': return await response.arrayBuffer();
          default: return await response.json();
        }
      } catch (err) {
        error = err;
        attempt++;
        
        if (attempt <= this.retries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          this.warn(`API call failed, retrying in ${delay}ms (${attempt}/${this.retries}):`, err);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    
    throw error;
  }
}

// Export all tools as a collection
export const tools = {
  memory: createMemoryStore(),
  llm: new LLMCallTool(),
  prompt: promptTemplate,
  json: jsonParser,
  chunks: textChunker,
  snapshot: stateSnapshot,
  fetch: new WebFetchTool()
};
