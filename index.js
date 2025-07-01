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

    this.tools = {}
    this.functions = {}
    this.provider_services = {}
    this.provider_services['openai'] = new OpenAiService(this)
    this.provider_services['anthropic'] = new AnthropicService(this)
    this.provider_services['gemini'] = new GeminiService(this)
    this.provider_services['stability'] = new StabilityService(this)
    this.provider_services['runway'] = new RunwayService(this)
    this.provider_services['elevenlabs'] = new ElevenLabsService(this)

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

  registerTool({ name, description, parameters, func }) {
    this.tools[name] = {
      name,
      description,
      parameters,
    }
    this.functions[name] = func
  }

  async generateText({
    provider = null,
    model,
    prompt,
    ai_rule,
    temperature = 0.7,
    max_tokens = 2000,
    web_search = false,
    conversation_history = null, // 기존 방식 (모든 provider 지원)
    use_conversation_state = false, // OpenAI Responses API 사용 여부
    store = true, // OpenAI Responses API에서 대화 저장 여부
    previous_response_id = null, // OpenAI Responses API용 이전 응답 ID
  }) {
    if (!provider && model) {
      provider = this.getProviderByModel(model)
    }
    provider = provider || 'openai'
    const ai_provider = this.provider_services[provider]

    const start_time = new Date()
    const result = await ai_provider.generateText({
      prompt,
      model,
      temperature,
      max_tokens,
      ai_rule,
      web_search,
      conversation_history,
      use_conversation_state, // OpenAI 전용
      store, // OpenAI 전용
      previous_response_id // OpenAI 전용
    })

    const end_time = new Date()
    const execution_time = (end_time - start_time) / 1000 // 초 단위
    debug(`처리 시간: ${execution_time}초`)

    return {
      ...result,
      execution_time,
      conversation_history: result.updated_conversation_history || conversation_history,
      response_id: result.response_id // OpenAI Responses API의 응답 ID (있는 경우)
    }
  }

  async generateImage({
    provider = 'openai',
    model,
    prompt,
    width = 1024,
    height = 1024,
    n = 1,
  }) {
    const ai_provider = this.provider_services[provider]

    const start_time = new Date()
    const {
      image,
      image_type, // base64, url, buffer
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
      image_type,
      input_tokens,
      output_tokens,
      total_tokens,
      error,
      model: model_used,
      cost,
      execution_time
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
  }) {
    const ai_provider = this.provider_services[provider]
    const start_time = new Date()
    const { audio, error, model_used, usage, cost } = await ai_provider.generateTTS({
      model,
      prompt,
      voice,
      voice_id,
      response_format,
      ai_rule,
    })
    const end_time = new Date()
    const execution_time = (end_time - start_time) / 1000 // 초 단위
    debug(`처리 시간: ${execution_time}초`)

    return {
      model: model_used,
      audio,
      error,
      usage,
      cost,
      execution_time
    }
  }

  async generateVideo({
    provider = 'runway',
    model,
    input,
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
      execution_time
    }
  }

  /**
   * 하나 또는 모든 AI 프로바이더 테스트
   * @param {string} [providerName] - 테스트할 프로바이더 이름 (선택사항). 제공하지 않으면 모든 프로바이더를 테스트합니다.
   * @param {string} [feature] - 테스트할 기능 ('text', 'image', 'audio', 'video', 'conversation', 'conversation_state'). null인 경우 모든 지원 기능을 테스트.
   * @param {Array} [system_tools] - 사용할 시스템 도구 배열 (예: ['web_search'])
   * @param {Array} [user_tools] - 사용자 도구 배열 (예: ['web_search'])
   */
  async test(providerName, feature = null, system_tools = [], user_tools = []) {
    if (providerName) {
      // 특정 프로바이더 테스트
      const provider_service = this.provider_services[providerName.toLowerCase()]
      if (!provider_service) {
        const message = `Provider '${providerName}' not found.Available providers: ${Object.keys(this.provider_services).join(', ')}`
        debug(message)
        return { error: message }
      }
      if (user_tools.includes('calculator')) {
        this.registerTool({
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
      debug(`\n${providerName} test begin(feature: ${feature || 'all'}, system_tools: ${system_tools}, user_tools: ${user_tools})`)
      
      // conversation 관련 테스트는 별도 처리
      if (feature === 'conversation') {
        await this.testConversation(providerName)
      } else if (feature === 'conversation_state') {
        if (providerName.toLowerCase() === 'openai') {
          await this.testConversationState()
        } else {
          debug(`Conversation State는 OpenAI에서만 지원됩니다. ${providerName}에서는 기존 conversation 테스트를 실행합니다.`)
          await this.testConversation(providerName)
        }
      } else {
        await provider_service.test({ feature, system_tools, user_tools })
      }
      
      debug(`${providerName} test completed`)
      return { status: 'completed', provider: providerName, feature, system_tools, user_tools }
    } else {
      // 모든 프로바이더 테스트
      const results = {}
      for (const [name, provider_service] of Object.entries(this.provider_services)) {
        debug(`\n${name} test begin(feature: ${feature || 'all'}, system_tools: ${system_tools}, user_tools: ${user_tools})`)
        
        // conversation 관련 테스트는 별도 처리
        if (feature === 'conversation') {
          await this.testConversation(name)
        } else if (feature === 'conversation_state') {
          if (name.toLowerCase() === 'openai') {
            await this.testConversationState()
          } else {
            debug(`Conversation State는 OpenAI에서만 지원됩니다. ${name}에서는 기존 conversation 테스트를 실행합니다.`)
            await this.testConversation(name)
          }
        } else {
          await provider_service.test({ feature, system_tools, user_tools })
        }
        
        debug(`${name} test completed`)
        results[name] = { status: 'completed', feature, system_tools, user_tools }
      }
      return { status: 'completed', results }
    }
  }

  // 대화 히스토리 테스트 함수 (기존 방식)
  async testConversation(provider = 'openai') {
    console.log(`\n=== ${provider.toUpperCase()} 대화 히스토리 테스트 (기존 방식) ===`)
    
    let conversation_history = null
    
    // 첫 번째 대화
    console.log('\n1. 첫 번째 질문: "내 이름을 김철수라고 기억해줘"')
    const response1 = await this.generateText({
      provider,
      prompt: '내 이름을 김철수라고 기억해줘',
      conversation_history
    })
    console.log('응답:', response1.text)
    conversation_history = response1.conversation_history
    
    // 두 번째 대화
    console.log('\n2. 두 번째 질문: "내 이름이 뭐야?"')
    const response2 = await this.generateText({
      provider,
      prompt: '내 이름이 뭐야?',
      conversation_history
    })
    console.log('응답:', response2.text)
    conversation_history = response2.conversation_history
    
    // 세 번째 대화
    console.log('\n3. 세 번째 질문: "내 이름을 영어로 써줘"')
    const response3 = await this.generateText({
      provider,
      prompt: '내 이름을 영어로 써줘',
      conversation_history
    })
    console.log('응답:', response3.text)
    conversation_history = response3.conversation_history
    
    // 네 번째 대화
    console.log('\n4. 네 번째 질문: "지금까지 우리가 나눈 대화를 요약해줘"')
    const response4 = await this.generateText({
      provider,
      prompt: '지금까지 우리가 나눈 대화를 요약해줘',
      conversation_history
    })
    console.log('응답:', response4.text)
    
    console.log('\n=== 대화 히스토리 테스트 완료 ===')
  }

  // OpenAI Conversation State 테스트 함수 (새로운 방식)
  async testConversationState() {
    console.log('\n=== OpenAI Conversation State 테스트 (새로운 방식) ===')
    
    let previous_response_id = null
    
    // 첫 번째 대화
    console.log('\n1. 첫 번째 질문: "내 이름을 김철수라고 기억해줘"')
    const response1 = await this.generateText({
      provider: 'openai',
      prompt: '내 이름을 김철수라고 기억해줘',
      use_conversation_state: true,
      store: true
    })
    console.log('응답:', response1.text)
    console.log('응답 ID:', response1.response_id)
    previous_response_id = response1.response_id
    
    // 두 번째 대화
    console.log('\n2. 두 번째 질문: "내 이름이 뭐야?"')
    const response2 = await this.generateText({
      provider: 'openai',
      prompt: '내 이름이 뭐야?',
      use_conversation_state: true,
      store: true,
      previous_response_id
    })
    console.log('응답:', response2.text)
    console.log('응답 ID:', response2.response_id)
    previous_response_id = response2.response_id
    
    // 세 번째 대화
    console.log('\n3. 세 번째 질문: "내 이름을 영어로 써줘"')
    const response3 = await this.generateText({
      provider: 'openai',
      prompt: '내 이름을 영어로 써줘',
      use_conversation_state: true,
      store: true,
      previous_response_id
    })
    console.log('응답:', response3.text)
    console.log('응답 ID:', response3.response_id)
    previous_response_id = response3.response_id
    
    // 네 번째 대화
    console.log('\n4. 네 번째 질문: "지금까지 우리가 나눈 대화를 요약해줘"')
    const response4 = await this.generateText({
      provider: 'openai',
      prompt: '지금까지 우리가 나눈 대화를 요약해줘',
      use_conversation_state: true,
      store: true,
      previous_response_id
    })
    console.log('응답:', response4.text)
    console.log('응답 ID:', response4.response_id)
    
    console.log('\n=== Conversation State 테스트 완료 ===')
    console.log('장점: 매번 전체 대화 히스토리를 전송하지 않아 토큰 효율적!')
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
    console.log('  node index.js <명령어> [옵션]')
    console.log('')
    console.log('명령어:')
    console.log('  text [provider]           - 텍스트 생성 테스트')
    console.log('  image [provider]          - 이미지 생성 테스트')
    console.log('  tts [provider]            - 음성 합성 테스트')
    console.log('  stt [provider]            - 음성 인식 테스트')
    console.log('  video [provider]          - 비디오 생성 테스트')
    console.log('  websearch [provider]      - 웹 검색 기능 테스트')
    console.log('  conversation [provider]   - 대화 히스토리 테스트 (기존 방식)')
    console.log('  conversation_state        - OpenAI Conversation State 테스트 (새로운 방식)')
    console.log('')
    console.log('Provider 옵션: openai, anthropic, gemini')
    console.log('')
    console.log('예시:')
    console.log('  node index.js text openai')
    console.log('  node index.js conversation anthropic')
    console.log('  node index.js conversation_state')
    console.log('  node index.js websearch gemini')
    console.log('')
    console.log('통합 테스트 (aiService.test() 사용):')
    console.log('  node index.js openai                 - OpenAI 모든 기능 테스트')
    console.log('  node index.js                        - 모든 provider 모든 기능 테스트')
    process.exit(0)
  }

  // 인수가 없으면 도움말 표시
  if (args.length === 0) {
    showHelp()
  }

  // 첫 번째 인자가 프로바이더 이름인지 확인
  if (firstArg && !['text', 'image', 'tts', 'video', 'stt', 'websearch', 'tool', 'image_generator', 'conversation', 'conversation_state'].includes(firstArg)) {
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

    const testConversation = async (providerName = 'openai') => {
      debug('=== 대화 히스토리 테스트 시작 ===')
      
      let conversation_history = null
      
      // 첫 번째 대화
      debug('첫 번째 질문: 내 이름을 김철수라고 기억해줘')
      const response1 = await aiService.generateText({
        provider: providerName,
        prompt: '내 이름을 김철수라고 기억해줘',
        conversation_history
      })
      debug('첫 번째 응답:', response1.text)
      conversation_history = response1.conversation_history
      
      // 두 번째 대화 (이전 대화 기억하는지 확인)
      debug('두 번째 질문: 내 이름이 뭐야?')
      const response2 = await aiService.generateText({
        provider: providerName,
        prompt: '내 이름이 뭐야?',
        conversation_history
      })
      debug('두 번째 응답:', response2.text)
      conversation_history = response2.conversation_history
      
      // 세 번째 대화 (더 복잡한 컨텍스트)
      debug('세 번째 질문: 내가 좋아하는 색깔은 파란색이야')
      const response3 = await aiService.generateText({
        provider: providerName,
        prompt: '내가 좋아하는 색깔은 파란색이야',
        conversation_history
      })
      debug('세 번째 응답:', response3.text)
      conversation_history = response3.conversation_history
      
      // 네 번째 대화 (이전 모든 정보 기억하는지 확인)
      debug('네 번째 질문: 내 이름과 좋아하는 색깔을 말해줘')
      const response4 = await aiService.generateText({
        provider: providerName,
        prompt: '내 이름과 좋아하는 색깔을 말해줘',
        conversation_history
      })
      debug('네 번째 응답:', response4.text)
      
      debug('=== 대화 히스토리 테스트 완료 ===')
      debug('최종 대화 히스토리:', JSON.stringify(response4.conversation_history, null, 2))
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
      case 'image_generator':
        debug('이미지 생성 테스트 실행')
        testRunner('text', [], ['image_generator']).then(() => debug('이미지 생성 테스트 완료'))
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
      case 'conversation':
        debug('대화 히스토리 테스트 실행')
        testConversation(provider).then(() => debug('대화 히스토리 테스트 완료'))
        break
      case 'conversation_state':
        debug('OpenAI Conversation State 테스트 실행')
        aiService.testConversationState().then(() => debug('OpenAI Conversation State 테스트 완료'))
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
