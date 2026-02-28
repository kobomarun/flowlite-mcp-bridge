/**
 * Research Flow - Ultra-compact implementation
 */

import { Flow, LLMTool, APITool, param, ParamType, apiKey } from '../flowlite.js';
import { summarize } from './summarize.flow.js';

// ===== Tools =====

// Define and export tools directly as instances
export const questionGenerator = new (class extends LLMTool {
  constructor() {
    super({ name: 'generateQuestions', temperature: 0.7 });
  }
  
  async execute({ topic, count = 3 }) {
    this.prompt = `Generate ${count} research questions about: ${topic}\nFormat as JSON array`;
    return super.execute({ topic, count });
  }
  
  processResponse(response) {
    const questions = typeof response === 'string' 
      ? JSON.parse(response.replace(/```json|```/g, '').trim())
      : response;
    return { questions: questions.slice(0, 3) };
  }
})();

export const webSearch = new (class extends APITool {
  constructor() {
    super({
      name: 'searchWeb',
      apiKeyParam: 'api_key',
      apiKeyEnvVar: 'SERPER_API_KEY'
    });
  }
  
  // Simulated search for demo purposes
  async execute({ query }) {
    this.debug(`Searching: ${query}`);
    return { 
      searchResults: `Simulated results for "${query}":\n` +
        `1. First finding about ${query}\n` +
        `2. Second finding about ${query}`
    };
  }
})();

// ===== Flow =====

// Ultra-compact flow definition
export const researchFlow = Flow.create({
  name: 'research',
  input: [param('topic', ParamType.STRING, 'Topic to research')],
  output: [param('summary', ParamType.STRING, 'Research summary')]
})
.next(async ({ topic }) => {
  // Generate questions
  const { questions } = await questionGenerator.call({ topic });
  
  // Research each question in parallel
  const searchResults = await Promise.all(
    questions.map(question => webSearch.call({ query: `${topic}: ${question}` }))
  );
  
  // Combine research
  const combinedResearch = searchResults
    .map((result, i) => `Q: ${questions[i]}\n${result.searchResults}`)
    .join('\n\n---\n\n');
  
  // Summarize research
  const summary = await summarize(combinedResearch);
  
  return { summary, questions };
});

// One-liner export for simple usage
export const research = topic => researchFlow.run({ topic });
