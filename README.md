# AI Service SDK

A unified Node.js SDK for integrating multiple AI service providers with a consistent API interface.

🇰🇷 여러 AI 서비스 제공업체를 일관된 API 인터페이스로 통합하는 통합 Node.js SDK입니다.

## Features

- **Multi-provider support**: OpenAI, Anthropic, Google Gemini, Stability AI, Runway, ElevenLabs
- **Unified API**: Consistent interface across all providers
- **Multiple AI capabilities**: Text generation, image generation, text-to-speech, video generation
- **Cost calculation**: Optional cost tracking for API usage
- **Environment-based configuration**: Easy setup with environment variables

🇰🇷 **기능**:
- **다중 제공업체 지원**: OpenAI, Anthropic, Google Gemini, Stability AI, Runway, ElevenLabs
- **통합 API**: 모든 제공업체에서 일관된 인터페이스
- **다양한 AI 기능**: 텍스트 생성, 이미지 생성, 텍스트 음성 변환, 비디오 생성
- **비용 계산**: API 사용량에 대한 선택적 비용 추적
- **환경 기반 구성**: 환경 변수로 쉬운 설정

## Supported AI Providers(🇰🇷 지원되는 AI 제공업체)

| Provider | Text Generation | Image Generation | Text-to-Speech | Video Generation |
|----------|----------------|------------------|----------------|------------------|
| OpenAI | ✅ | ✅ | ✅ | ❌ |
| Anthropic | ✅ | ❌ | ❌ | ❌ |
| Google Gemini | ✅ | ❌ | ❌ | ❌ |
| Stability AI | ❌ | ✅ | ❌ | ❌ |
| Runway | ❌ | ❌ | ❌ | ✅ |
| ElevenLabs | ❌ | ❌ | ✅ | ❌ |

## Default Models(🇰🇷 기본 모델)

When you don't specify a model, the SDK automatically uses the first available model for each provider:

🇰🇷 모델을 지정하지 않으면 SDK가 각 제공업체의 첫 번째 사용 가능한 모델을 자동으로 사용합니다:

| Provider | Text Generation | Image Generation | Text-to-Speech |
|----------|----------------|------------------|----------------|
| OpenAI | `gpt-4.1` | `gpt-image-1` | `gpt-4o-mini-tts` |
| Anthropic | `claude-sonnet-4-0` | - | - |
| Google Gemini | `gemini-2.5-flash-preview-05-20` | `gemini-2.0-flash-preview-image-generation` | `gemini-2.5-pro-preview-tts` |
| Stability AI | - | `stable-diffusion-v1-5` | - |
| Runway | - | - | - |
| ElevenLabs | - | - | `eleven_flash_v2` |

## Installation

```bash
npm install @librorum/aiservice
# or
yarn add @librorum/aiservice
# or
bun add @librorum/aiservice
```

🇰🇷 **설치**

## Environment Setup

Create a `.env` file in your project root and add your API keys:

🇰🇷 프로젝트 루트에 `.env` 파일을 생성하고 API 키를 추가하세요:

```env
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GEMINI_API_KEY=your_gemini_api_key
STABILITY_API_KEY=your_stability_api_key
RUNWAY_API_KEY=your_runway_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
```

## Usage Examples

### Basic Setup

```javascript
import { AIService } from 'aiservice';

const ai_service = new AIService();

// Check API key configuration
const api_status = ai_service.testApiKeys();
console.log(api_status);
```

🇰🇷 **기본 설정**

### Text Generation

```javascript
// Using default models (recommended for quick start)
// 🇰🇷 기본 모델 사용 (빠른 시작에 권장)
const { text, usage, cost } = await ai_service.generateText({
  provider: 'openai',
  prompt: 'Explain quantum computing in simple terms'
});

const { text: anthropic_text, usage: anthropic_usage, cost: anthropic_cost } = await ai_service.generateText({
  provider: 'anthropic',
  prompt: 'Write a creative story about AI'
});

// Specifying custom models
// 🇰🇷 사용자 지정 모델 지정
const { text: custom_text, usage: custom_usage, cost: custom_cost } = await ai_service.generateText({
  provider: 'openai',
  model: 'gpt-4o',
  prompt: 'Explain quantum computing in simple terms',
  temperature: 0.7,
  max_tokens: 1000
});

const { text: claude_text, usage: claude_usage, cost: claude_cost } = await ai_service.generateText({
  provider: 'anthropic',
  model: 'claude-opus-4-0',
  prompt: 'Write a creative story about AI',
  temperature: 0.8
});

// Response structure
// 🇰🇷 응답 구조
console.log(text);    // Generated text
console.log(usage);   // { input_tokens, output_tokens, total_tokens }
console.log(cost);    // Cost information (if calculate_cost: true)
```

🇰🇷 **텍스트 생성**

### Image Generation

```javascript
import fs from 'fs/promises';

// Using default models
// 🇰🇷 기본 모델 사용
const { image, usage, cost } = await ai_service.generateImage({
  provider: 'openai',
  prompt: 'A futuristic city with flying cars'
});

// Save image buffer to file
// 🇰🇷 이미지 버퍼를 파일로 저장
await fs.writeFile('generated_image.jpg', image);

const { image: stability_image, usage: stability_usage, cost: stability_cost } = await ai_service.generateImage({
  provider: 'stability',
  prompt: 'A beautiful landscape with mountains and lakes'
});

await fs.writeFile('stability_image.jpg', stability_image);

// Specifying custom models and parameters
// 🇰🇷 사용자 지정 모델 및 매개변수 지정
const { image: custom_image, usage: custom_usage, cost: custom_cost } = await ai_service.generateImage({
  provider: 'openai',
  model: 'dall-e-3',
  prompt: 'A futuristic city with flying cars',
  width: 1024,
  height: 1024,
  n: 1
});

await fs.writeFile('custom_image.jpg', custom_image);

// Response structure
// 🇰🇷 응답 구조
console.log('Image saved to file');    // Generated image buffer saved
console.log(usage);    // { input_tokens, output_tokens, total_tokens }
console.log(cost);     // Cost information (if calculate_cost: true)
```

🇰🇷 **이미지 생성**

### Text-to-Speech

```javascript
import fs from 'fs/promises';

// Using default models
// 🇰🇷 기본 모델 사용
const { audio, usage, cost } = await ai_service.generateTTS({
  provider: 'openai',
  prompt: 'Hello, this is a test of text-to-speech functionality'
});

// Save audio buffer to file
// 🇰🇷 오디오 버퍼를 파일로 저장
await fs.writeFile('generated_audio.mp3', audio);

const { audio: elevenlabs_audio, usage: elevenlabs_usage, cost: elevenlabs_cost } = await ai_service.generateTTS({
  provider: 'elevenlabs',
  prompt: 'Welcome to our AI service platform'
});

await fs.writeFile('elevenlabs_audio.mp3', elevenlabs_audio);

// Specifying custom models and parameters
// 🇰🇷 사용자 지정 모델 및 매개변수 지정
const { audio: custom_audio, usage: custom_usage, cost: custom_cost } = await ai_service.generateTTS({
  provider: 'openai',
  model: 'tts-1',
  prompt: 'Hello, this is a test of text-to-speech functionality',
  voice: 'alloy',
  response_format: 'mp3'
});

await fs.writeFile('custom_audio.mp3', custom_audio);

// Response structure
// 🇰🇷 응답 구조
console.log('Audio saved to file');    // Generated audio buffer saved
console.log(usage);    // { input_tokens, output_tokens, total_tokens }
console.log(cost);     // Cost information (if calculate_cost: true)
```

🇰🇷 **텍스트 음성 변환**

### Video Generation

```javascript
import fs from 'fs/promises';

// Runway video generation
const { video, usage, cost } = await ai_service.generateVideo({
  provider: 'runway',
  model: 'gen3a_turbo',
  input: {
    prompt: 'A cat walking through a garden',
    duration: 5
  }
});

// Save video buffer to file
// 🇰🇷 비디오 버퍼를 파일로 저장
await fs.writeFile('generated_video.mp4', video);

console.log('Video saved to file');    // Generated video saved
console.log(usage);    // Usage information
console.log(cost);     // Cost information (if calculate_cost: true)
```

🇰🇷 **비디오 생성**

### Cost Calculation

Enable cost calculation by setting `calculate_cost: true`:

🇰🇷 `calculate_cost: true`를 설정하여 비용 계산을 활성화하세요:

```javascript
const { text, usage, cost } = await ai_service.generateText({
  provider: 'openai',
  model: 'gpt-4',
  prompt: 'Explain machine learning',
  calculate_cost: true
});

console.log(cost); // Cost information
console.log(usage); // Token usage information
```

## API Reference

### generateText(options)

Generate text using various AI providers.

🇰🇷 다양한 AI 제공업체를 사용하여 텍스트를 생성합니다.

**Parameters:**
- `provider` (string): AI provider ('openai', 'anthropic', 'gemini')
- `model` (string): Model name
- `prompt` (string): Input prompt
- `ai_rule` (string, optional): Additional AI instructions
- `temperature` (number, optional): Creativity level (0-1)
- `max_tokens` (number, optional): Maximum response length
- `calculate_cost` (boolean, optional): Enable cost calculation

### generateImage(options)

Generate images using AI providers.

🇰🇷 AI 제공업체를 사용하여 이미지를 생성합니다.

**Parameters:**
- `provider` (string): AI provider ('openai', 'stability')
- `model` (string): Model name
- `prompt` (string): Image description
- `width` (number, optional): Image width
- `height` (number, optional): Image height
- `n` (number, optional): Number of images to generate
- `calculate_cost` (boolean, optional): Enable cost calculation

### generateTTS(options)

Convert text to speech.

🇰🇷 텍스트를 음성으로 변환합니다.

**Parameters:**
- `provider` (string): AI provider ('openai', 'elevenlabs')
- `model` (string): Model name
- `prompt` (string): Text to convert
- `voice` (string, optional): Voice type (OpenAI)
- `voice_id` (string, optional): Voice ID (ElevenLabs)
- `response_format` (string, optional): Audio format
- `calculate_cost` (boolean, optional): Enable cost calculation

### generateVideo(options)

Generate videos using AI providers.

🇰🇷 AI 제공업체를 사용하여 비디오를 생성합니다.

**Parameters:**
- `provider` (string): AI provider ('runway')
- `model` (string): Model name
- `input` (object): Video generation parameters
- `calculate_cost` (boolean, optional): Enable cost calculation

## API Pricing Information

- **Google Gemini**: https://ai.google.dev/gemini-api/docs/pricing
- **Anthropic**: https://www.anthropic.com/pricing#api
- **OpenAI**: https://openai.com/api/pricing/

🇰🇷 **API 가격 정보**

## License

MIT

🇰🇷 **라이선스**: MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

🇰🇷 기여를 환영합니다! 언제든지 Pull Request를 제출해 주세요.