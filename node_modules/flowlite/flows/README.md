# Flowlite Flow Examples

This directory contains example flows that demonstrate the power and flexibility of the Flowlite framework. These examples showcase how to create elegant, minimal flows that leverage the object-oriented architecture of Flowlite.

## Ultra-Compact Flow Design

These flows demonstrate the most terse, elegant implementations possible with Flowlite's architecture. They showcase how to create powerful, readable flows with minimal code.

### Key Principles

#### 1. One-Step Tool Definition

Tools are defined and instantiated in a single step using anonymous class expressions:

```javascript
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
```

#### 2. Concise Flow Definitions

Flow definitions focus solely on the sequence of operations with minimal metadata:

```javascript
export const summarizeFlow = Flow.create({
  name: 'summarize',
  input: [param('text', ParamType.STRING, 'Text to summarize')],
  output: [param('summary', ParamType.STRING, 'Summarized text')]
})
.next(async ({ text, maxChunkSize }) => {
  // Processing logic...
});
```

#### 3. Flow Composition

Flows directly use other flows as functions:

```javascript
// Research the topic
const { summary } = await research(topic);
return { research: summary };
```

## Available Flows

### 1. Summarize Flow (`summarize.flow.js`)

A flow that summarizes text by chunking it and processing each chunk.

```ditaa
+------------+      +---------------+      +----------------+
| Input Text |----->| Chunk Text    |----->| Summarize Each |
|            |      | into Segments |      | Chunk          |
+------------+      +---------------+      +----------------+
                                                   |
                                                   v
                                           +-----------------+
                                           | Combine         |
                                           | Summaries       |
                                           | (if multiple)   |
                                           +-----------------+
                                                   |
                                                   v
                                           +-----------------+
                                           | Final Summary   |
                                           +-----------------+
```

```javascript
// One-line usage
import { summarize } from './flows/summarize.flow.js';
const summary = await summarize("Long text to summarize...");
```

### 2. Research Flow (`research.flow.js`)

A flow that conducts research on a topic by generating questions, searching for information, and summarizing the results.

```ditaa
+-------------+      +-------------------+      +----------------+
| Topic Input |----->| Generate Research |----->| Perform Web    |
|             |      | Questions         |      | Searches       |
+-------------+      +-------------------+      +----------------+
                                                       |
                                                       v
                                               +----------------+
                                               | Combine Search |
                                               | Results        |
                                               +----------------+
                                                       |
                                                       v
                                               +----------------+
                                               | Summarize      |
                                               | Research       |
                                               +----------------+
                                                       |
                                                       v
                                               +----------------+
                                               | Final Research |
                                               | Report         |
                                               +----------------+
```

```javascript
// One-line usage
import { research } from './flows/research.flow.js';
const researchResults = await research("Artificial Intelligence");
```

### 3. Content Creator Flow (`content-creator.flow.js`)

A flow that creates optimized content based on a topic and audience by determining the content type, generating a title, and creating an outline.

```ditaa
+-------------+      +----------------+      +-------------------+
| Topic &     |----->| Research Topic |----->| Determine Content |
| Audience    |      |                |      | Type              |
+-------------+      +----------------+      +-------------------+
                                                      |
                                                      v
                                             +-------------------+
                                             | Generate Title    |
                                             | Options           |
                                             +-------------------+
                                                      |
                                                      v
                                             +-------------------+
                                             | Create Content    |
                                             | Outline           |
                                             +-------------------+
                                                      |
                                                      v
                                             +-------------------+
                                             | Final Content     |
                                             | Structure         |
                                             +-------------------+
```

```javascript
// One-line usage
import { createContent } from './flows/content-creator.flow.js';
const content = await createContent("AI Ethics", "technical audience");

// With options
const customContent = await createContent("Quantum Computing", "beginners", {
  contentType: "How-to Guide"
});
