# Flowlite

A lightweight, composable JavaScript framework for building LLM-powered agent flows.

## Overview

Flowlite is a modern JavaScript framework that makes it easy to build structured, chainable workflows for LLM-powered agents. It provides a clean, concise syntax for defining complex flows while maintaining readability and flexibility.

```ditaa
+---------------+       +---------------+       +---------------+
| Tool Classes  |       | Flow Builder  |       | Flow Executor |
|               |       |               |       |               |
| - LLMTool     |<----->| - Flow.create |<----->| - run()       |
| - APITool     |       | - next()      |       | - execute()   |
| - Tool        |       | - on()        |       |               |
+---------------+       +---------------+       +---------------+
        ^                      ^                      ^
        |                      |                      |
        v                      v                      v
+---------------+       +---------------+       +---------------+
| Memory System |       | Logging System|       | Error Handling|
|               |       |               |       |               |
| - store()     |       | - LogLevel    |       | - retry       |
| - retrieve()  |       | - setLogger() |       | - fallback    |
+---------------+       +---------------+       +---------------+
```

Key features:
- **Simple, chainable API** - Build flows with minimal code
- **Class-based tool architecture** - Inherit and extend base tool classes
- **Built-in LLM tools** - Structured LLM calls with retry logic and validation
- **Integrated logging system** - Granular control over logging and statistics
- **Memory management** - Store and retrieve data across interactions
- **Tool registry** - Register and compose reusable tools
- **Parallel execution** - Run tasks concurrently for efficiency
- **Branching logic** - Create conditional paths based on results

## Installation

```bash
npm install flowlite
```

## Hello World Example

Let's start with a simple "hello world" example:

```js
import { Flow } from 'flowlite';

// Ultra-compact flow definition
export const greet = Flow.create({ name: 'greet', input: [{ name: 'name', type: 'string', description: 'Name to greet' }] })
  .next(({ name = 'World' }) => {
    console.log(`Hello, ${name}!`);
    return { greeted: true };
  });

// Run the flow
greet.run({ name: 'Flowlite' });
// Output: Hello, Flowlite!
```

## Basic Concepts

### Nodes and Flows

The core building blocks of Flowlite are **Nodes** (units of work) and **Flows** (sequences of nodes):

```ditaa
                Flow Execution
                     |
                     v
+------------+    +------+    +------------+    +------------+
| Input      |--->| Node |--->| Node       |--->| Output     |
| Parameters |    |  1   |    |  2         |    | State      |
+------------+    +------+    +------------+    +------------+
                     ^            ^
                     |            |
              +------------+ +------------+
              | Tool       | | Tool       |
              | Definition | | Definition |
              +------------+ +------------+
```

```js
import { Flow, param, ParamType } from 'flowlite';

// Ultra-compact tool definitions with inline metadata
const fetchData = async ({ id }) => {
  const data = await fetch(`https://api.example.com/data/${id}`);
  return { data: await data.json() };
};
fetchData.metadata = { name: 'fetchData', input: [param('id', ParamType.STRING, 'ID to fetch')] };

const processData = ({ data }) => ({
  processed: data.map(item => item.value * 2),
  status: 'complete'
});
processData.metadata = { name: 'processData' };

// Compact flow definition
export const dataFlow = Flow.create({ name: 'dataFlow' })
  .next(fetchData)
  .next(processData);

dataFlow.run({ id: '12345' });
```

### Branching Logic

Flows can branch based on the output of nodes:

```ditaa
                    +-------------+
                    | Input State |
                    +-------------+
                           |
                           v
                    +-------------+
                    | Branch Node |
                    +-------------+
                           |
              +------------+------------+
              |            |            |
              v            v            v
      +-------------+  +----------+  +------------+
      | "question"  |  | "request"|  | "statement"|
      | Branch      |  | Branch   |  | Branch     |
      +-------------+  +----------+  +------------+
              |            |            |
              v            v            v
      +-------------+  +----------+  +------------+
      | Question    |  | Request  |  | Statement  |
      | Handler     |  | Handler  |  | Handler    |
      +-------------+  +----------+  +------------+
              |            |            |
              +------------+------------+
                           |
                           v
                    +-------------+
                    | Final State |
                    +-------------+
```

```js
import { Flow } from 'flowlite';

// Ultra-compact branching flow with inline functions
export const conversationFlow = Flow.create({ name: 'conversation', input: [param('text', ParamType.STRING, 'User input')] })
  .next(({ text }) => {
    if (text.includes('question')) return 'question';
    if (text.includes('request')) return 'request';
    return 'statement';
  })
  .on('question', ({ text }) => ({ response: `To answer your question: ${text}` }))
  .on('request', ({ text }) => ({ response: `I'll process your request: ${text}` }))
  .on('statement', ({ text }) => ({ response: `I acknowledge your statement: ${text}` }));

const result = await conversationFlow.run({ text: 'Can you answer a question for me?' });
console.log(result.response);
// Output: To answer your question: Can you answer a question for me?
```

## Working with LLMs

Flowlite includes built-in tools for working with LLMs:

```js
import { Flow, LLMTool, param, ParamType } from 'flowlite';

// Ultra-compact LLM tool using class expression
const generateResponse = new class extends LLMTool {
  constructor() {
    super({
      name: 'generateResponse',
      description: 'Generate a response to user input',
      input: [param('input', ParamType.STRING, 'User input')]
    });
  }
  
  buildPrompt({ input }) {
    return `You are a helpful assistant. User: ${input}`;
  }
  
  processResponse(response) {
    return { response };
  }
}();

// Compact flow with direct tool usage
export const chatFlow = Flow.create({ name: 'chat' })
  .next(async (state) => generateResponse.call(state));

const result = await chatFlow.run({ input: 'Tell me a joke about programming' });
console.log(result.response);
```

## Class-Based Tool Architecture

Flowlite provides a powerful class-based architecture for creating tools with inheritance:

```ditaa
+------------------------+
|        Tool            |
|------------------------|
| + metadata             |
| + execute()            |
| + call()               |
| + withApiKey()         |
| + setLogLevel()        |
+------------------------+
           ^
           |
           |
+------------------------+     +------------------------+
|       LLMTool          |     |       APITool          |
|------------------------|     |------------------------|
| + buildPrompt()        |     | + fetchWithApiKey()    |
| + processResponse()    |     | + handleApiError()     |
| + withModel()          |     | + withRetry()          |
+------------------------+     +------------------------+
```

```js
import { LLMTool, APITool, param, ParamType } from 'flowlite';

// Ultra-compact LLM tool using class expression
const summarize = new class extends LLMTool {
  constructor() {
    super({
      name: 'summarize',
      description: 'Summarizes text content',
      input: [
        param('text', ParamType.STRING, 'Text to summarize'),
        param('maxLength', ParamType.NUMBER, 'Maximum length of summary', { optional: true })
      ]
    });
  }
  
  buildPrompt({ text, maxLength = 100 }) {
    return `Summarize the following text in ${maxLength} words or less:
${text}

Provide a concise summary that captures the key points.`;
  }
  
  processResponse(response) {
    return { summary: response };
  }
}();

// Ultra-compact API tool using class expression
const getWeather = new class extends APITool {
  constructor() {
    super({
      name: 'getWeather',
      description: 'Gets current weather for a location',
      input: [param('location', ParamType.STRING, 'City name or coordinates')]
    });
    this.withApiKey('WEATHER_API_KEY');
  }
  
  async execute({ location }) {
    const url = `https://api.weather.com/v1/current?location=${encodeURIComponent(location)}`;
    const response = await this.fetchWithApiKey(url);
    const data = await response.json();
    
    return {
      temperature: data.current.temperature,
      conditions: data.current.conditions,
      city: data.location.name
    };
  }
}();

// Ultra-compact weather flow
export const weatherFlow = Flow.create({ name: 'weather', input: [param('city', ParamType.STRING, 'City to check weather for')] })
  .next(async ({ city }) => {
    const weather = await getWeather.call({ location: city });
    const summary = await summarize.call({
      text: `The weather in ${city} is ${weather.temperature}°C and ${weather.conditions}.`
    });
    
    return { weatherSummary: summary.summary };
  });
```

## Integrated Logging System

Flowlite includes a comprehensive logging system for debugging and performance monitoring:

```ditaa
                  +----------------+
                  |   LogLevel     |
                  |----------------|
                  | NONE           |
                  | ERROR          |
                  | WARN           |
                  | INFO           |
                  | DEBUG          |
                  | TRACE          |
                  +----------------+
                         ^
                         |
          +-----------------------------+
          |                             |
+-----------------+           +-----------------+
|      Flow       |           |      Tool       |
|-----------------|           |-----------------|
| + setLogLevel() |<--------->| + setLogLevel() |
| + setLogger()   |           | + setLogger()   |
| + debug()       |           | + debug()       |
| + info()        |           | + info()        |
| + warn()        |           | + warn()        |
| + error()       |           | + error()       |
+-----------------+           +-----------------+
```

```js
import { Flow, LogLevel, LLMTool } from 'flowlite';

// Configure log levels with chainable API
const summarizer = new class extends LLMTool {
  constructor() {
    super({ name: 'summarize', description: 'Summarizes text' });
  }
  
  buildPrompt({ text }) {
    return `Summarize: ${text}`;
  }
}()
.setLogLevel(LogLevel.DEBUG)
.setLogger(console);

// Track performance statistics
const stats = summarizer.getStats();
console.log(`Executions: ${stats.executionCount}, Avg time: ${stats.averageExecutionTime}ms`);

// Reset statistics
summarizer.resetStats();
```

## Memory Management

Store and retrieve data across interactions:

```js
import { Flow } from 'flowlite';
import { createMemoryStore } from 'flowtools';

// Create a memory store
const memory = createMemoryStore();

// Ultra-compact memory flow
export const memoryFlow = Flow.create({ name: 'memoryFlow' })
  .next(({ name }) => {
    memory({ key: 'userName', value: name, action: 'set' });
    return { remembered: true };
  })
  .next(() => {
    const name = memory('userName') || 'stranger';
    return { greeting: `Hello again, ${name}!` };
  });

// First run to store the name
await memoryFlow.run({ name: 'Alice' });

// Second run to retrieve the name
const result = await memoryFlow.run({});
console.log(result.greeting);
// Output: Hello again, Alice!
```

## Tool Registry

Register and use tools across different flows:

```js
import { Flow, Tool, param, ParamType } from 'flowlite';

// Ultra-compact tool definition
const helloWorldTool = new class extends Tool {
  constructor() {
    super({
      name: 'helloWorld',
      description: 'Says hello to someone',
      input: [param('name', ParamType.STRING, 'Name to greet', { optional: true })]
    });
  }
  
  execute({ name = 'World' }) {
    return `Hello, ${name}!`;
  }
}();

// Ultra-compact planner flow
export const plannerFlow = Flow.create({ name: 'planner' })
  .next(({ needsGreeting, name }) => needsGreeting 
    ? { result: helloWorldTool.call({ name }), toolUsed: 'helloWorld' }
    : { result: 'No greeting needed', toolUsed: 'none' }
  );

const result = await plannerFlow.run({ 
  needsGreeting: true, 
  name: 'Flowlite User' 
});

console.log(result);
// Output: { result: 'Hello, Flowlite User!', toolUsed: 'helloWorld' }
```

## Parallel Execution

Run multiple tasks in parallel:

```js
import { Flow, param, ParamType } from 'flowlite';

// Ultra-compact parallel flow
export const userFlow = Flow.create({ name: 'userFlow', input: [param('userId', ParamType.STRING, 'User ID to fetch')] })
  .next(async ({ userId }) => {
    // Run multiple fetches in parallel
    const [userData, userPosts] = await Promise.all([
      fetch(`/api/users/${userId}`).then(r => r.json()),
      fetch(`/api/users/${userId}/posts`).then(r => r.json())
    ]);
    
    // Return combined results
    return {
      user: {
        ...userData,
        posts: userPosts
      }
    };
  });

const result = await userFlow.run({ userId: '12345' });
console.log(result.user);
```

## Flow Control Patterns

Flowlite provides several powerful patterns for controlling the flow of execution. Here are some simple examples demonstrating the most common patterns:

### 1. Branching

Branch your flow based on conditions or decisions:

```ditaa
                   +---------------+
                   |  Input State  |
                   +---------------+
                          |
                          v
                   +---------------+
                   | Decision Node |
                   +---------------+
                          |
             +------------+------------+
             |            |            |
             v            v            v
     +---------------+ +----------+ +------------+
     |  Condition A  | |Condition B| |Condition C|
     +---------------+ +----------+ +------------+
             |            |            |
             v            v            v
     +---------------+ +----------+ +------------+
     |  Handler A    | | Handler B | | Handler C  |
     +---------------+ +----------+ +------------+
             |            |            |
             +------------+------------+
                          |
                          v
                   +---------------+
                   |  Final Result |
                   +---------------+
```

```js
import { Flow, param, ParamType } from 'flowlite';

// Ultra-compact branching flow
export const classifyText = Flow.create({ 
  name: 'classifyText', 
  input: [param('text', ParamType.STRING, 'Text to classify')] 
})
.next(({ text }) => {
  // Determine the category based on content
  if (text.includes('question')) return 'question';
  if (text.includes('complaint')) return 'complaint';
  return 'feedback';
})
.on('question', ({ text }) => ({ 
  response: `I'll answer your question: ${text}`,
  category: 'question'
}))
.on('complaint', ({ text }) => ({ 
  response: `I'm sorry about your issue: ${text}`,
  category: 'complaint'
}))
.on('feedback', ({ text }) => ({ 
  response: `Thank you for your feedback: ${text}`,
  category: 'feedback'
}));

// Usage
const result = await classifyText.run({ text: "I have a question about my order" });
console.log(result.response); // "I'll answer your question: I have a question about my order"
```

### 2. Looping

Create loops to process items or repeat operations until a condition is met:

```ditaa
                   +---------------+
                   |  Input Items  |
                   +---------------+
                          |
                          v
                   +---------------+
                   | Initialize    |
                   | Counter       |
                   +---------------+
                          |
                          v
              +-----> +---------------+
              |       | Check if Done |
              |       +---------------+
              |              |
              |              v
              |       +---------------+
              |       | More Items?   |
              |       +---------------+
              |            /   \
              |       Yes /     \ No
              |          /       \
              |         v         v
              |  +---------------+ +---------------+
              |  | Process Item  | | Return Result |
              |  +---------------+ +---------------+
              |         |
              |         v
              |  +---------------+
              |  | Increment     |
              |  | Counter       |
              |  +---------------+
              |         |
              +---------+
```

```js
import { Flow, param, ParamType } from 'flowlite';

// Ultra-compact looping flow
export const processItems = Flow.create({ 
  name: 'processItems', 
  input: [param('items', ParamType.ARRAY, 'Items to process')] 
})
.next(({ items }) => {
  // Initialize state for the loop
  return { 
    items,
    results: [],
    currentIndex: 0
  };
})
.next(function processLoop({ items, results, currentIndex }) {
  // Check if we're done
  if (currentIndex >= items.length) {
    return { done: true, results };
  }
  
  // Process the current item
  const item = items[currentIndex];
  const processedItem = `Processed: ${item}`;
  
  // Update state and continue the loop
  return { 
    items,
    results: [...results, processedItem],
    currentIndex: currentIndex + 1,
    done: false
  };
})
.on(state => !state.done, function continueLoop(state) {
  // Continue the loop by calling the process function again
  return this.getNode('processLoop').execute(state);
})
.on(state => state.done, state => ({ finalResults: state.results }));

// Usage
const result = await processItems.run({ items: ['apple', 'banana', 'cherry'] });
console.log(result.finalResults); 
// ["Processed: apple", "Processed: banana", "Processed: cherry"]
```

### 3. Parallel Processing

Execute multiple operations simultaneously for better performance:

```ditaa
                   +---------------+
                   |  Input State  |
                   +---------------+
                          |
                          v
                   +---------------+
                   | Split Tasks   |
                   +---------------+
                          |
             +------------+------------+
             |            |            |
             v            v            v
     +---------------+ +----------+ +------------+
     |   Task A      | |  Task B  | |   Task C   |
     | (Parallel)    | |(Parallel)| | (Parallel) |
     +---------------+ +----------+ +------------+
             |            |            |
             v            v            v
     +---------------+ +----------+ +------------+
     |  Result A     | | Result B | |  Result C  |
     +---------------+ +----------+ +------------+
             |            |            |
             +------------+------------+
                          |
                          v
                   +---------------+
                   | Combine       |
                   | Results       |
                   +---------------+
```

```js
import { Flow, param, ParamType } from 'flowlite';

// Define some async operations
const fetchUserProfile = async (userId) => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 300));
  return { id: userId, name: `User ${userId}`, email: `user${userId}@example.com` };
};

const fetchUserPosts = async (userId) => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 500));
  return [
    { id: 1, title: `Post 1 by User ${userId}` },
    { id: 2, title: `Post 2 by User ${userId}` }
  ];
};

const fetchUserFollowers = async (userId) => {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 400));
  return [userId + 1, userId + 2, userId + 3];
};

// Ultra-compact parallel processing flow
export const getUserData = Flow.create({ 
  name: 'getUserData', 
  input: [param('userId', ParamType.NUMBER, 'User ID to fetch')] 
})
.next(async ({ userId }) => {
  // Execute all fetches in parallel
  const [profile, posts, followers] = await Promise.all([
    fetchUserProfile(userId),
    fetchUserPosts(userId),
    fetchUserFollowers(userId)
  ]);
  
  // Combine the results
  return {
    userData: {
      ...profile,
      posts,
      followers,
      followerCount: followers.length
    }
  };
});

// Usage
const result = await getUserData.run({ userId: 42 });
console.log(result.userData);
// { id: 42, name: "User 42", email: "user42@example.com", posts: [...], followers: [...], followerCount: 3 }
```

### 4. Planning

Implement a planning pattern where one node decides what actions to take next:

```ditaa
                   +---------------+
                   |  Input Query  |
                   +---------------+
                          |
                          v
                   +---------------+
                   |  Analyze      |
                   |  Query        |
                   +---------------+
                          |
                          v
                   +---------------+
                   |  Create       |
                   |  Action Plan  |
                   +---------------+
                          |
                          v
                   +---------------+
                   | Select Tools  |
                   +---------------+
                          |
             +------------+------------+
             |            |            |
             v            v            v
     +---------------+ +----------+ +------------+
     | Execute Tool A| |Execute B | |Execute C   |
     | (if needed)   | |(if needed)| |(if needed)|
     +---------------+ +----------+ +------------+
             |            |            |
             +------------+------------+
                          |
                          v
                   +---------------+
                   | Combine       |
                   | Results       |
                   +---------------+
```

```js
import { Flow, LLMTool, param, ParamType } from 'flowlite';

// Define some tools that the planner can use
const calculator = (expression) => {
  return { result: eval(expression) };
};
calculator.metadata = { name: 'calculator', description: 'Evaluates a math expression' };

const weatherLookup = (location) => {
  return { weather: `Sunny and 72°F in ${location}` };
};
weatherLookup.metadata = { name: 'weatherLookup', description: 'Gets weather for a location' };

const translator = (text, language) => {
  return { translation: `[${text}] translated to ${language}` };
};
translator.metadata = { name: 'translator', description: 'Translates text to another language' };

// Define a planner tool using LLMTool
const queryPlanner = new class extends LLMTool {
  constructor() {
    super({
      name: 'planner',
      description: 'Plans which tools to use for a query',
      input: [param('query', ParamType.STRING, 'User query')]
    });
  }
  
  buildPrompt({ query }) {
    return `Determine which tool to use for this query: "${query}"
Available tools:
- calculator: For math calculations
- weatherLookup: For weather information
- translator: For translating text

Return one of: "calculator", "weather", "translate", or "unknown".`;
  }
  
  processResponse(response) {
    const tool = response.trim().toLowerCase();
    if (tool.includes('calculator')) return { tool: 'calculator' };
    if (tool.includes('weather')) return { tool: 'weather' };
    if (tool.includes('translate')) return { tool: 'translate' };
    return { tool: 'unknown' };
  }
}();

// Ultra-compact planning flow
export const assistantFlow = Flow.create({ 
  name: 'assistant', 
  input: [param('query', ParamType.STRING, 'User query')] 
})
.next(async ({ query }) => {
  // Plan which tool to use
  const { tool } = await queryPlanner.call({ query });
  
  // Extract relevant information based on the tool
  let result;
  switch (tool) {
    case 'calculator':
      const expression = query.replace(/[^0-9+\-*/().]/g, '');
      result = calculator(expression);
      break;
    case 'weather':
      const location = query.replace(/weather|in|what's|the|like|how|is|it|in/gi, '').trim();
      result = weatherLookup(location);
      break;
    case 'translate':
      const match = query.match(/translate\s+"([^"]+)"\s+to\s+(\w+)/i);
      if (match) {
        result = translator(match[1], match[2]);
      } else {
        result = { error: "Couldn't parse translation request" };
      }
      break;
    default:
      result = { response: "I'm not sure how to help with that query." };
  }
  
  return { 
    originalQuery: query,
    toolUsed: tool,
    ...result
  };
});

// Usage
const result1 = await assistantFlow.run({ query: "What's 25 * 4 + 10?" });
console.log(result1); // { originalQuery: "What's 25 * 4 + 10?", toolUsed: "calculator", result: 110 }

const result2 = await assistantFlow.run({ query: "What's the weather in Miami?" });
console.log(result2); // { originalQuery: "What's the weather in Miami?", toolUsed: "weather", weather: "Sunny and 72°F in Miami" }
```

## Complete Example: Weather Assistant

Here's a more complete example that demonstrates several Flowlite features:

```ditaa
+--------------------+     +--------------------+     +--------------------+
| User Query         |---->| Location Extractor |---->| Weather API        |
| "Weather in NYC?"  |     | LLMTool            |     | APITool            |
+--------------------+     +--------------------+     +--------------------+
                                                              |
                                                              v
                           +--------------------+     +--------------------+
                           | Response Generator |<----| Memory Store       |
                           | LLMTool            |     | (save location)    |
                           +--------------------+     +--------------------+
                                    |
                                    v
                           +--------------------+
                           | Weather Report     |
                           | (Final Response)   |
                           +--------------------+
```

```js
import { Flow, LLMTool, APITool, param, ParamType } from 'flowlite';
import { createMemoryStore } from 'flowtools';

// Create a memory store
const memory = createMemoryStore();

// Ultra-compact tools using class expressions
const locationExtractor = new class extends LLMTool {
  constructor() {
    super({
      name: 'extractLocation',
      description: 'Extract location from weather request',
      input: [param('request', ParamType.STRING, 'Weather request text')]
    });
  }
  
  buildPrompt({ request }) {
    return `Extract the location from this weather request: "${request}"`;
  }
  
  processResponse(response) {
    return { location: response.trim() };
  }
}();

const weatherApi = new class extends APITool {
  constructor() {
    super({
      name: 'getWeather',
      description: 'Get weather data for a location',
      input: [param('location', ParamType.STRING, 'Location to get weather for')]
    });
  }
  
  async execute({ location }) {
    const response = await fetch(`https://api.weather.com/${location}`);
    return await response.json();
  }
}();

const weatherReporter = new class extends LLMTool {
  constructor() {
    super({
      name: 'generateWeatherReport',
      description: 'Create a friendly weather report',
      input: [
        param('location', ParamType.STRING, 'Location'),
        param('data', ParamType.OBJECT, 'Weather data')
      ]
    });
  }
  
  buildPrompt({ location, data }) {
    return `Create a friendly weather report for ${location} based on this data: ${JSON.stringify(data)}`;
  }
}();

// Ultra-compact weather flow
export const weatherFlow = Flow.create({ name: 'weatherAssistant', input: [param('input', ParamType.STRING, 'User weather query')] })
  .next(async ({ input }) => {
    const { location } = await locationExtractor.call({ request: input });
    const weatherData = await weatherApi.call({ location });
    memory({ key: 'lastLocation', value: location, action: 'set' });
    const response = await weatherReporter.call({ location, data: weatherData });
    return { response };
  });

// Run the flow
const result = await weatherFlow.run({ 
  input: "What's the weather like in San Francisco today?" 
});

console.log(result.response);
```

## Documentation

For more detailed documentation and examples, see:
- [Flow Tools Documentation](./flowtools.md) - Built-in tools and utilities
- [Flow Examples](./flows/) - Example flows demonstrating various patterns

## Example Applications

Flowlite includes several example applications to demonstrate its capabilities:

### Article Writer

A CLI tool for generating high-quality articles with AI assistance. Features include:
- Research-based article generation
- SEO and copywriting quality checks
- Fancy CLI interface with ASCII art and colors
- Structured workflow using Flowlite's Flow API

To try it out:
```bash
cd example_apps/article-writer
npm install
npm start
```

See the [Article Writer README](./example_apps/article-writer/README.md) for more details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request at https://github.com/chadananda/flowlite/pulls

## License

MIT
