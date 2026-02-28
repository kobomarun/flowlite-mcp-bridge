/**
 * Summarize Flow - Ultra-compact implementation
 */

import { Flow, LLMTool, param, ParamType, apiKey } from '../flowlite.js';
import { textChunker } from '../flowtools.js';

// ===== Tools =====

// Define and export tools directly as instances
export const chunkText = new (class extends LLMTool {
  constructor() {
    super({ name: 'chunkText', description: 'Splits text into chunks' });
  }
  
  async execute({ text, maxChunkSize = 2000 }) {
    return { chunks: textChunker(text, maxChunkSize) };
  }
})();

export const summarizeChunk = new (class extends LLMTool {
  constructor() {
    super({ name: 'summarizeChunk', temperature: 0.3 });
  }
  
  async execute({ chunk, maxLength = 200 }) {
    this.prompt = `Summarize in ${maxLength} chars max:\n\n${chunk}`;
    return super.execute({ chunk, maxLength });
  }
  
  processResponse(response) {
    return { summary: response.trim() };
  }
})();

export const combineSummaries = new (class extends LLMTool {
  constructor() {
    super({ name: 'combineSummaries', temperature: 0.3 });
  }
  
  async execute({ summaries, maxLength = 500 }) {
    this.prompt = `Combine into one (${maxLength} chars max):\n\n${summaries.join('\n\n')}`;
    return super.execute({ summaries, maxLength });
  }
  
  processResponse(response) {
    return { summary: response.trim() };
  }
})();

// ===== Flow =====

// Ultra-compact flow definition
export const summarizeFlow = Flow.create({
  name: 'summarize',
  input: [param('text', ParamType.STRING, 'Text to summarize')],
  output: [param('summary', ParamType.STRING, 'Summarized text')],
  apiKeys: [apiKey('openai', 'OpenAI API Key', 'OPENAI_API_KEY')]
})
.next(async ({ text, maxChunkSize }) => {
  // Get chunks
  const { chunks } = await chunkText.call({ text, maxChunkSize });
  
  // Handle single chunk case
  if (chunks.length === 1) return summarizeChunk.call({ chunk: chunks[0] });
  
  // Process multiple chunks in parallel
  const summaries = await Promise.all(
    chunks.map(chunk => summarizeChunk.call({ chunk }).then(r => r.summary))
  );
  
  // Combine summaries
  return combineSummaries.call({ summaries });
});

// One-liner export for simple usage
export const summarize = text => summarizeFlow.run({ text });
