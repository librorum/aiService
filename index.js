import Debug from 'debug'
const debug = Debug('ai_service:ai_service')
import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'
import OpenAiService from './provider_services/openai_service.js'
import AnthropicService from './provider_services/anthropic_service.js'
import GeminiService from './provider_services/gemini_service.js'
import StabilityService from './provider_services/stability_service.js'
import RunwayService from './provider_services/runway_service.js'
import ElevenLabsService from './provider_services/elevenlabs_service.js'


let ai_models = []

// 1M 단위로 저장된 가격을 1토큰 단위로 변환
/*
UPDATE AIModels
SET
  input_token_price = input_token_price_1M / 1000000,
  output_token_price = output_token_price_1M / 1000000;
*/


class AIService {
  constructor() {
    // this.factory = aiServiceFactory

    // 서비스 시작시에 API 키 유효성 체크
    this.checkApiKey()

    this.provider_services = {}
    this.provider_services['openai'] = new OpenAiService()
    this.provider_services['anthropic'] = new AnthropicService()
    this.provider_services['gemini'] = new GeminiService()
    this.provider_services['stability'] = new StabilityService()
    this.provider_services['runway'] = new RunwayService()
    this.provider_services['elevenlabs'] = new ElevenLabsService()
  }

  /**
   * API 키 설정 상태 확인 (서비스 시작시 자동 호출됨)
   * 콘솔에 API 키 설정 상태를 출력하여 개발자가 확인할 수 있게 함
   */
  checkApiKey() {
    debug('===== AI 서비스 API 키 설정 상태 확인 =====')

    debug('OPENAI_API_KEY', process.env.OPENAI_API_KEY)
    debug('ANTHROPIC_API_KEY', process.env.ANTHROPIC_API_KEY)
    debug('GEMINI_API_KEY', process.env.GEMINI_API_KEY)
    debug('STABILITY_API_KEY', process.env.STABILITY_API_KEY)
    debug('RUNWAY_API_KEY', process.env.RUNWAY_API_KEY)
    debug('ELEVENLABS_API_KEY', process.env.ELEVENLABS_API_KEY)
    debug('TOPVIEW_API_KEY', process.env.TOPVIEW_API_KEY)

    const api_keys = {
      'OpenAI API': process.env.OPENAI_API_KEY,
      'Anthropic API': process.env.ANTHROPIC_API_KEY,
      'Google Gemini API': process.env.GEMINI_API_KEY,
      'Stability AI API': process.env.STABILITY_API_KEY,
      'Runway API': process.env.RUNWAY_API_KEY,
      'ElevenLabs API': process.env.ELEVENLABS_API_KEY,
      'TopView API': process.env.TOPVIEW_API_KEY
    }

    let all_keys_valid = true

    for (const [service_name, api_key] of Object.entries(api_keys)) {
      const status = api_key ? '✅ 설정됨' : '❌ 설정되지 않음'
      debug(`${service_name}: ${status}`)

      if (!api_key) all_keys_valid = false
    }

    if (!all_keys_valid) {
      debug('일부 API 키가 설정되지 않았습니다. .env 파일을 확인하세요.')
    } else {
      debug('모든 API 키가 정상적으로 설정되었습니다.')
    }

    debug('=========================================')
  }

  /**
   * API 키 유효성 간단 테스트
   * 각 서비스에 대해 API 키가 비어있지 않은지 확인하고 결과 반환
   * @returns {Object} API 키 설정 상태 객체
   */
  testApiKeys() {
    const results = {
      openai: {
        provider: 'openAI',
        key_configured: !!process.env.OPENAI_API_KEY,
      },
      anthropic: {
        provider: 'anthropic',
        key_configured: !!process.env.ANTHROPIC_API_KEY,
      },
      gemini: {
        provider: 'gemini',
        key_configured: !!process.env.GEMINI_API_KEY,
      },
      stability: {
        provider: 'stability',
        key_configured: !!process.env.STABILITY_API_KEY,
      },
      runway: {
        provider: 'runway',
        key_configured: !!process.env.RUNWAY_API_KEY,
      },
      elevenlabs: {
        provider: 'elevenlabs',
        key_configured: !!process.env.ELEVENLABS_API_KEY,
      }
    }

    debug('===== API 키 설정 상태 테스트 =====')
    debug('🇰🇷 API 키 설정 상태를 테스트합니다.')

    for (const [provider_id, status] of Object.entries(results)) {
      const status_icon = status.key_configured ? '✅' : '❌'
      const status_text = status.key_configured ? '설정됨' : '설정되지 않음'

      debug(`${status_icon} ${status.provider}: ${status_text} `)
      // const supported_features = Object.entries(status.supports)
      //   .filter(([feature, supported]) => supported)
      //   .map(([feature]) => feature)
      // debug(`   지원 기능: ${supported_features.join(', ')} `)
    }

    return results
  }

  /**
   * 텍스트 생성을 지원하는 모든 모델 정보를 반환
   * @returns {Array} 모델명과 프로바이더 정보를 포함한 객체 배열
   */
  getModels() {
    const text_models = []

    // 각 프로바이더에서 텍스트 지원 모델 수집
    for (const [provider_name, provider_service] of Object.entries(this.provider_services)) {
      if (provider_service.models_info) {
        const provider_text_models = provider_service.models_info
          .filter(model_info => model_info.support_text_output === true)
          .map(model_info => ({
            model: model_info.model,
            provider: provider_name
          }))

        text_models.push(...provider_text_models)
      }
    }

    return text_models
  }

  getProviderByModel(model) {
    for (const [provider_name, provider_service] of Object.entries(this.provider_services)) {
      if (provider_service.models_info) {
        const provider_model_info = provider_service.models_info.find(model_info => model_info.model === model)
        if (provider_model_info) {
          return provider_name
        }
      }
    }
    return null
  }

  async generateText({
    provider = null,
    model,
    prompt,
    ai_rule,
    temperature = 0.7,
    max_tokens = 2000,
    calculate_cost = false,
    web_search = false
  }) {
    if (!provider && model) {
      provider = this.getProviderByModel(model)
    }
    provider = provider || 'openai'
    const ai_provider = this.provider_services[provider]

    const start_time = new Date()
    const { text, usage, error, cost, model_used } = await ai_provider.generateText({
      prompt,
      model,
      temperature,
      max_tokens,
      ai_rule,
      calculate_cost,
      web_search
    })

    const end_time = new Date()
    const execution_time = (end_time - start_time) / 1000 // 초 단위
    debug(`처리 시간: ${execution_time}초`)

    return {
      model: model_used,
      text: text || '',
      usage,
      cost,
      error,
    }
  }

  async generateImage({
    provider = 'openai',
    model,
    prompt,
    width = 1024,
    height = 1024,
    n = 1,
    calculate_cost = false
  }) {
    const ai_provider = this.provider_services[provider]

    const start_time = new Date()
    const {
      image,
      input_tokens,
      output_tokens,
      total_tokens,
      error,
      model_used,
      cost
    } = await ai_provider.generateImage({
      model,
      prompt,
      width,
      height,
      n,
    })

    const end_time = new Date()
    const execution_time = (end_time - start_time) / 1000 // 초 단위
    debug(`처리 시간: ${execution_time}초`)

    return {
      image,
      input_tokens,
      output_tokens,
      total_tokens,
      error,
      model: model_used,
      cost,
    }
  }

  async generateTTS({
    provider = 'openai',
    model,
    prompt,
    voice,
    voice_id,
    response_format = 'mp3',
    ai_rule = 'Speak in a friendly and engaging tone',
    calculate_cost = false,
  }) {
    const ai_provider = this.provider_services[provider]
    const start_time = new Date()
    const { audio, error, model_used, cost } = await ai_provider.generateTTS({
      model,
      prompt,
      voice,
      voice_id,
      response_format,
      ai_rule,
      calculate_cost
    })

    const end_time = new Date()
    const execution_time = (end_time - start_time) / 1000 // 초 단위
    debug(`처리 시간: ${execution_time}초`)

    return {
      model: model_used,
      audio,
      error,
      cost,
    }
  }

  async generateVideo({
    provider = 'runway',
    model,
    input,
    calculate_cost = false,
    ...options
  }) {
    const ai_provider = this.provider_services[model]

    const start_time = new Date()
    const result = await ai_provider.generateVideo(input, {
      model,
      ...options
    })

    const end_time = new Date()
    const execution_time = (end_time - start_time) / 1000 // 초 단위
    debug(`처리 시간: ${execution_time}초`)


    return {
      data: result.data || result,
    }
  }

  /**
   * 하나 또는 모든 AI 프로바이더 테스트
   * @param {string} [providerName] - 테스트할 프로바이더 이름 (선택사항). 제공하지 않으면 모든 프로바이더를 테스트합니다.
   * @param {string} [feature] - 테스트할 기능 ('text', 'image', 'audio', 'video'). null인 경우 모든 지원 기능을 테스트.
   * @param {Array} [system_tools] - 사용할 시스템 도구 배열 (예: ['web_search'])
   * @param {Array} [user_tools] - 사용자 도구 배열 (예: ['web_search'])
   */
  async test(providerName, feature = null, system_tools = [], user_tools = []) {
    if (providerName) {
      // 특정 프로바이더 테스트
      const provider_service = this.provider_services[providerName.toLowerCase()]
      if (!provider_service) {
        const message = `Provider '${providerName}' not found. Available providers: ${Object.keys(this.provider_services).join(', ')}`
        debug(message)
        return { error: message }
      }
      if (user_tools.includes('calculator')) {
        provider_service.registerTool({
          name: 'calculator',
          description: 'Evaluates a mathematical expression.',
          parameters: {
            type: 'object',
            properties: {
              expression: {
                type: 'string',
                description: 'The mathematical expression to evaluate, e.g., "1+2*3"',
              },
            },
            required: ['expression'],
            additionalProperties: false,
          },
          func: ({ expression }) => {
            try {
              // 입력된 수식을 안전하게 평가합니다.
              if (!/^[0-9+\-*/().\s]+$/.test(expression)) {
                throw new Error("Invalid expression")
              }
              const result = Function(`"use strict"; return (${expression})`)()
              return result
            } catch (error) {
              return "Invalid expression"
            }
          }
        })
      }
      debug(`\n${providerName} test begin (feature: ${feature || 'all'}, system_tools: ${system_tools}, user_tools: ${user_tools})`)
      await provider_service.test({ feature, system_tools, user_tools })
      debug(`${providerName} test completed`)
      return { status: 'completed', provider: providerName, feature, system_tools, user_tools }
    } else {
      // 모든 프로바이더 테스트
      const results = {}
      for (const [name, provider_service] of Object.entries(this.provider_services)) {
        debug(`\n${name} test begin (feature: ${feature || 'all'}, system_tools: ${system_tools}, user_tools: ${user_tools})`)
        await provider_service.test({ feature, system_tools, user_tools })
        debug(`${name} test completed`)
        results[name] = { status: 'completed', feature, system_tools, user_tools }
      }
      return { status: 'completed', results }
    }
  }
}

const aiService = new AIService()

console.log(aiService.getModels())

export default aiService

// 메인 실행부
// 🇰🇷 메인 실행부입니다.
debug('import.meta.url', import.meta.url)
if (import.meta.url === `file://${process.argv[1]}`) {
  debug('메인 실행부')

  // 명령줄 인수 처리
  const args = process.argv.slice(2)
  const firstArg = args[0]?.toLowerCase()
  const secondArg = args[1]?.toLowerCase()

  // 사용 가능한 프로바이더 목록
  const availableProviders = Object.keys(aiService.provider_services).join(', ')

  // 도움말 출력 함수
  const showHelp = () => {
    console.log('\n사용법:')
    console.log('  node index.js [test_type] [provider]')
    console.log('  node index.js [provider]\n')

    console.log('테스트 유형 (test_type):')
    console.log('  text     - 텍스트 생성 테스트 (특정 기능만 테스트)')
    console.log('  image    - 이미지 생성 테스트 (특정 기능만 테스트)')
    console.log('  tts      - 텍스트 음성 변환 테스트 (특정 기능만 테스트)')
    console.log('  video    - 비디오 생성 테스트 (특정 기능만 테스트)')
    console.log('  stt      - 음성 인식 테스트 (특정 기능만 테스트)')
    console.log('  websearch - 웹 검색 도구를 사용한 텍스트 생성 테스트\n')

    console.log('사용 가능한 프로바이더 (provider):')
    console.log(`  ${availableProviders.replace(/, /g, '\n  ')}\n`)

    console.log('예시:')
    console.log('  node index.js                     - 도움말 표시')
    console.log('  node index.js openai              - OpenAI 프로바이더의 모든 기능 테스트')
    console.log('  node index.js text                - 모든 프로바이더의 텍스트 생성 기능만 테스트')
    console.log('  node index.js image openai        - OpenAI의 이미지 생성 기능만 테스트')
    console.log('  node index.js tts elevenlabs      - ElevenLabs의 TTS 기능만 테스트')
    console.log('  node index.js websearch           - 웹 검색 도구를 사용한 텍스트 생성 테스트')
    console.log('  node index.js websearch openai    - OpenAI에서 웹 검색 도구를 사용한 텍스트 생성 테스트\n')

    process.exit(0)
  }

  // 인수가 없으면 도움말 표시
  if (args.length === 0) {
    showHelp()
  }

  // 첫 번째 인자가 프로바이더 이름인지 확인
  if (firstArg && !['text', 'image', 'tts', 'video', 'stt', 'websearch', 'tool'].includes(firstArg)) {
    // 프로바이더 지정 테스트 실행
    debug(`${firstArg} 프로바이더 테스트 실행`)
    aiService.test(firstArg).then(() => {
      debug(`${firstArg} 프로바이더 테스트 완료`)
    })
  } else {
    // 기존 테스트 유형에 따른 실행
    const testType = firstArg
    const provider = secondArg // 두 번째 인자로 프로바이더 지정 가능

    const testRunner = async (feature = null, system_tools = [], user_tools = []) => {
      if (provider) {
        // 특정 프로바이더에 대한 테스트 실행
        debug(`${provider} 프로바이더의 ${testType || '기본'} 테스트 실행`)
        await aiService.test(provider, feature, system_tools, user_tools)
      } else {
        // 전체 프로바이더 테스트 실행
        debug(`${testType || '기본'} 테스트 실행`)
        await aiService.test(null, feature, system_tools, user_tools)
      }
    }

    switch (testType) {
      case 'text':
        debug('텍스트 생성 테스트 실행')
        testRunner('text').then(() => debug('텍스트 생성 테스트 완료'))
        break
      case 'websearch':
        debug('웹 검색 테스트 실행')
        testRunner('text', ['web_search'], []).then(() => debug('웹 검색 테스트 완료'))
        break
      case 'tool':
        debug('tool 테스트 실행')
        testRunner('text', [], ['calculator']).then(() => debug('tool 테스트 완료'))
        break
      case 'image':
        debug('이미지 생성 테스트 실행')
        testRunner('image').then(() => debug('이미지 생성 테스트 완료'))
        break
      case 'tts':
        debug('TTS 테스트 실행')
        testRunner('audio').then(() => debug('TTS 테스트 완료'))
        break
      case 'video':
        debug('비디오 생성 테스트 실행')
        testRunner('video').then(() => debug('비디오 생성 테스트 완료'))
        break
      case 'stt':
        debug('STT 테스트 실행')
        testRunner('audio').then(() => debug('STT 테스트 완료'))
        break
      default:
        if (testType) {
          debug(`알 수 없는 테스트 유형: ${testType}. 사용 가능한 테스트 유형: text, image, tts, video, stt, websearch`)
          debug(`사용 가능한 프로바이더: ${availableProviders}`)
        }
        debug('기본 테스트 실행')
        testRunner().then(() => debug('기본 테스트 완료'))
    }
  }
}
