/**
 * Content Creator Flow - Ultra-compact implementation
 */

import { Flow, LLMTool, param, ParamType } from '../flowlite.js';
import { research } from './research.flow.js';

// ===== Tools =====

// Define and export tools directly as instances
export const contentTypeTool = new (class extends LLMTool {
  constructor() {
    super({ name: 'determineContentType', temperature: 0.4 });
  }
  
  async execute({ topic, audience }) {
    this.prompt = `Best content type for "${topic}" targeting ${audience}?
Choose from: Article, List, How-to, Comparison, Case Study
Respond as JSON: contentType, reasoning, structure, wordCount`;
    return super.execute({ topic, audience });
  }
  
  processResponse(response) {
    return JSON.parse(response.replace(/```json|```/g, '').trim());
  }
})();

export const titleGenerator = new (class extends LLMTool {
  constructor() {
    super({ name: 'generateTitle', temperature: 0.7 });
  }
  
  async execute({ topic, contentType }) {
    this.prompt = `Create 3 engaging titles for a ${contentType} about "${topic}"`;
    return super.execute({ topic, contentType });
  }
  
  processResponse(response) {
    const titles = response.split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => line.replace(/^\d+\.\s*/, '').trim());
    return { title: titles[0] };
  }
})();

export const outlineCreator = new (class extends LLMTool {
  constructor() {
    super({ name: 'createOutline', temperature: 0.5 });
  }
  
  async execute({ topic, contentType, research }) {
    this.prompt = `Outline for ${contentType} about "${topic}".
Include: sections, keyPoints, keywords
Research: ${research?.substring(0, 800) || 'N/A'}`;
    return super.execute({ topic, contentType, research });
  }
  
  processResponse(response) {
    return JSON.parse(response.replace(/```json|```/g, '').trim());
  }
})();

export const contentGenerator = new (class extends LLMTool {
  constructor() {
    super({ name: 'generateContent', temperature: 0.7, maxTokens: 2000 });
  }
  
  async execute({ contentType, title, outline, research }) {
    // Adapt prompt based on content type
    this.prompt = contentType.toLowerCase().includes('list') 
      ? `List article "${title}" with items:\n${outline.sections.map(s => `- ${s.title}`).join('\n')}`
      : contentType.toLowerCase().includes('how-to')
        ? `How-to guide "${title}" with steps:\n${outline.sections.map((s, i) => `Step ${i+1}: ${s.title}`).join('\n')}`
        : `Article "${title}" with sections:\n${outline.sections.map(s => `## ${s.title}`).join('\n')}`;
    
    this.prompt += `\nKey points: ${outline.keyPoints.join(', ')}`;
    
    return super.execute({ contentType, title, outline, research });
  }
  
  processResponse(response) {
    return { content: response };
  }
})();

// ===== Flow =====

// Ultra-compact flow definition
export const contentCreatorFlow = Flow.create({
  name: 'createContent',
  input: [
    param('topic', ParamType.STRING, 'Content topic'),
    param('audience', ParamType.STRING, 'Target audience')
  ],
  output: [param('content', ParamType.STRING, 'Generated content')]
})
.next(async ({ topic }) => {
  // Research the topic
  const { summary } = await research(topic);
  return { research: summary };
})
.next(async ({ topic, audience, contentType, research }) => {
  // Determine content type if not specified
  if (!contentType) {
    const result = await contentTypeTool.call({ topic, audience });
    return { contentTypeInfo: result };
  }
  return { contentTypeInfo: { contentType, structure: 'User-specified' }};
})
.next(async ({ topic, contentTypeInfo }) => {
  // Generate title
  return titleGenerator.call({ topic, contentType: contentTypeInfo.contentType });
})
.next(async ({ topic, contentTypeInfo, research, title }) => {
  // Create outline
  const outline = await outlineCreator.call({
    topic, contentType: contentTypeInfo.contentType, research
  });
  return { outline };
})
.next(async ({ contentTypeInfo, title, outline, research }) => {
  // Generate content
  return contentGenerator.call({
    contentType: contentTypeInfo.contentType, title, outline, research
  });
});

// One-liner export for simple usage
export const createContent = (topic, audience, options = {}) => 
  contentCreatorFlow.run({ topic, audience, ...options });
