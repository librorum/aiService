# AI Service SDK

🚀 **A unified Node.js SDK for integrating multiple AI service providers with a consistent API interface.**

여러 AI 서비스 제공업체를 일관된 API 인터페이스로 통합하는 통합 Node.js SDK입니다.

## ✨ Key Features

- 🤖 **Multi-provider support**: OpenAI, Anthropic, Google Gemini, Stability AI, Runway, ElevenLabs
- 🔄 **Unified API**: Consistent interface across all providers
- 💬 **Advanced Conversation Management**: Support for both conversation history and server-side conversation state
- 🌐 **Web Search Integration**: Real-time web search capabilities with integrated AI processing
- 🛠️ **Custom Tools**: Register and use custom functions with AI models
- 💰 **Cost Tracking**: Automatic cost calculation for API usage (USD & KRW)
- ⚙️ **Environment-based Configuration**: Easy setup with environment variables
- 🧪 **Comprehensive Testing**: Built-in test suite for all features

## 🎯 Supported AI Providers

| Provider | Text | Image | TTS | Video | Web Search | Conversation |
|----------|------|-------|-----|-------|------------|-------------|
| **OpenAI** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ (History + State) |
| **Anthropic** | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ (History) |
| **Google Gemini** | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ (History) |
| **Stability AI** | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Runway** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **ElevenLabs** | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |

## 🔧 Installation

```bash
pnpm add @librorum/aiservice
# or
npm install @librorum/aiservice
# or
yarn add @librorum/aiservice
```

## 🌍 Environment Setup

Create a `.env` file in your project root:

```env
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GEMINI_API_KEY=your_gemini_api_key
STABILITY_API_KEY=your_stability_api_key
RUNWAY_API_KEY=your_runway_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

## 🚀 Quick Start

```javascript
import aiService from '@librorum/aiservice';

// Check API key status
const api_status = aiService.testApiKeys();
console.log(api_status);

// Simple text generation
const { text } = await aiService.generateText({
  provider: 'openai',
  prompt: 'Hello, world!'
});

console.log(text);
```

## 💬 Conversation Management

### Method 1: Conversation History (All Providers)

```javascript
// Start a conversation
let conversation_history = [];

// First message
const response1 = await aiService.generateText({
  provider: 'openai', // or 'anthropic', 'gemini'
  prompt: 'My name is John. Remember this.',
  conversation_history
});

conversation_history = response1.conversation_history;
console.log(response1.text); // "I'll remember that your name is John."

// Continue conversation
const response2 = await aiService.generateText({
  provider: 'openai',
  prompt: 'What is my name?',
  conversation_history
});

console.log(response2.text); // "Your name is John."
```

### Method 2: Conversation State (OpenAI Only)

```javascript
// First message with conversation state
const response1 = await aiService.generateText({
  provider: 'openai',
  prompt: 'My name is John. Remember this.',
  use_conversation_state: true,
});

console.log(response1.response_id); // "resp_xxx..."

// Continue with response ID
const response2 = await aiService.generateText({
  provider: 'openai',
  prompt: 'What is my name?',
  use_conversation_state: true,
  previous_response_id: response1.response_id
});

console.log(response2.text); // "Your name is John."
```

## 🎨 Text Generation

```javascript
// Basic usage
const { text, usage, cost } = await aiService.generateText({
  provider: 'openai',
  prompt: 'Explain quantum computing'
});

// Advanced options
const response = await aiService.generateText({
  provider: 'anthropic',
  model: 'claude-sonnet-4-0',
  prompt: 'Write a creative story',
  temperature: 0.8,
  max_tokens: 1000,
  ai_rule: 'Write in a friendly tone'
});

// With web search
const { text: searchResult } = await aiService.generateText({
  provider: 'gemini',
  prompt: 'Find recent AI news and summarize',
  system_tools: ['web_search']
});
```

## 🖼️ Image Generation

```javascript
import fs from 'fs/promises';

// Basic image generation
const { image } = await aiService.generateImage({
  provider: 'openai',
  prompt: 'A futuristic city with flying cars'
});

await fs.writeFile('image.jpg', image);

// Custom parameters
const { image: customImage } = await aiService.generateImage({
  provider: 'stability',
  model: 'stable-diffusion-v1-5',
  prompt: 'A serene mountain landscape',
  width: 1024,
  height: 1024
});
```

## 🔊 Text-to-Speech

```javascript
import fs from 'fs/promises';

// OpenAI TTS
const { audio } = await aiService.generateTTS({
  provider: 'openai',
  prompt: 'Hello, this is a test.',
  voice: 'alloy'
});

await fs.writeFile('speech.mp3', audio);

// ElevenLabs TTS
const { audio: elevenAudio } = await aiService.generateTTS({
  provider: 'elevenlabs',
  prompt: 'Hello, this is ElevenLabs.',
  voice_id: 'your_voice_id'
});
```

## 🎬 Video Generation

```javascript
// Runway video generation
const { video } = await aiService.generateVideo({
  provider: 'runway',
  input: {
    prompt: 'A serene lake with mountains',
    duration: 5
  }
});

await fs.writeFile('video.mp4', video);
```

## 🛠️ Custom Tools

```javascript
// Register a calculator tool
aiService.registerTool({
  name: 'calculator',
  description: 'Evaluates mathematical expressions',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate'
      }
    },
    required: ['expression']
  },
  func: async ({ expression }) => {
    try {
      return Function(`"use strict"; return (${expression})`)()
    } catch (error) {
      return "Invalid expression"
    }
  }
});

// Use the tool
const { text } = await aiService.generateText({
  provider: 'openai',
  prompt: 'Calculate 15 * 23 + 45',
  user_tools: ['calculator']
});
```

## 🧪 Testing

```javascript
// Test all providers
await aiService.test();

// Test specific provider
await aiService.test('openai');

// Test specific feature
await aiService.test('gemini', 'text');

// Test with tools
await aiService.test('openai', 'text', ['web_search'], ['calculator']);
```

### NPM Test Scripts

```bash
# Basic tests
pnpm test                        # Test all features
pnpm run test:openai            # Test OpenAI
pnpm run test:websearch         # Test web search

# Conversation tests
pnpm run test:conversation       # Test all providers
pnpm run test:conversation:openai        # OpenAI history
pnpm run test:conversation:anthropic     # Anthropic history
pnpm run test:conversation:gemini        # Gemini history
pnpm run test:conversation_state         # OpenAI state mode

# Media tests
pnpm run test:stability         # Image generation
pnpm run test:elevenlabs        # Text-to-speech
pnpm run test:runway           # Video generation
```

## 💰 Cost Tracking

```javascript
const { text, usage, cost } = await aiService.generateText({
  provider: 'openai',
  prompt: 'Hello world'
});

console.log(usage); // { input_tokens: 10, output_tokens: 5, total_tokens: 15 }
console.log(cost);  // { usd: 0.0001, krw: 0.13 }
```

## API Reference

### generateText(options)
{{ ... }}
Generate text using various AI providers.

 다양한 AI 제공업체를 사용하여 텍스트를 생성합니다.

**Parameters:**
- `provider` (string): AI provider ('openai', 'anthropic', 'gemini')
- `model` (string): Model name
- `prompt` (string): Input prompt
- `ai_rule` (string, optional): Additional AI instructions
- `temperature` (number, optional): Creativity level (0-1)
- `max_tokens` (number, optional): Maximum response length
- `web_search` (boolean, optional): Enable web search integration
- `system_tools` (array, optional): System tools to use (e.g., ['web_search'])
- `user_tools` (array, optional): User tools to use (e.g., ['calculator'])

### generateImage(options)

Generate images using AI providers.

 AI 제공업체를 사용하여 이미지를 생성합니다.

**Parameters:**
- `provider` (string): AI provider ('openai', 'stability')
- `model` (string): Model name
- `prompt` (string): Image description
- `width` (number, optional): Image width
- `height` (number, optional): Image height
- `n` (number, optional): Number of images to generate

### generateTTS(options)

Convert text to speech.

 텍스트를 음성으로 변환합니다.

**Parameters:**
- `provider` (string): AI provider ('openai', 'elevenlabs')
- `model` (string): Model name
- `prompt` (string): Text to convert
- `voice` (string, optional): Voice type (OpenAI)
- `voice_id` (string, optional): Voice ID (ElevenLabs)
- `response_format` (string, optional): Audio format

### generateVideo(options)

Generate videos using AI providers.

 AI 제공업체를 사용하여 비디오를 생성합니다.

**Parameters:**
- `provider` (string): AI provider ('runway')
- `model` (string): Model name
- `input` (object): Video generation parameters

### test(providerName, feature, system_tools, user_tools)

Test AI provider functionality with specific features and tools.

 특정 기능과 도구로 AI 제공업체 기능을 테스트합니다.

**Parameters:**
- `providerName` (string, optional): Provider name to test. If null, tests all providers
- `feature` (string, optional): Feature to test ('text', 'image', 'audio', 'video'). If null, tests all features
- `system_tools` (array, optional): System tools to include in test (e.g., ['web_search'])
- `user_tools` (array, optional): User tools to include in test (e.g., ['calculator'])

**Returns:**
- Promise that resolves to test results object

## API Pricing Information

- **Google Gemini**: https://ai.google.dev/gemini-api/docs/pricing
- **Anthropic**: https://www.anthropic.com/pricing#api
- **OpenAI**: https://openai.com/api/pricing/

 **API 가격 정보**

## License

MIT

 **라이선스**: MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

 기여를 환영합니다! 언제든지 Pull Request를 제출해 주세요.