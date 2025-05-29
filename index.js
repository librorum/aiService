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


  // async calculateCost({ model, input_tokens, output_tokens }) {
  //   const ai_model = this.ai_models.find(m => m.model === model)
  //   if (ai_model == null) {
  //     debug('모델을 찾을 수 없음:', model)
  //     return {
  //       points: 0,
  //       input_cost: 0,
  //       output_cost: 0,
  //       total_cost_usd: 0,
  //       total_cost_krw: 0,
  //       provider: null,
  //       model: model
  //     }
  //   }

  //   const input_cost = ai_model.input_token_price * input_tokens
  //   const output_cost = ai_model.output_token_price * output_tokens
  //   const total_cost_usd = input_cost + output_cost
  //   const total_cost_krw = total_cost_usd * usd_to_krw
  //   debug('input_cost', input_cost)
  //   debug('output_cost', output_cost)
  //   debug('total_cost_usd', total_cost_usd)
  //   debug('total_cost_krw', total_cost_krw)

  //   return {
  //     input_cost,
  //     output_cost,
  //     total_cost_usd,
  //     total_cost_krw,
  //   }
  // }

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

  async generateText({
    provider = 'openai',
    model,
    prompt,
    ai_rule,
    temperature = 0.7,
    max_tokens = 2000,
    calculate_cost = false
  }) {
    const ai_provider = this.provider_services[provider]

    const start_time = new Date()
    const { text, usage, error, cost, model_used } = await ai_provider.generateText({
      prompt,
      model,
      temperature,
      max_tokens,
      ai_rule,
      calculate_cost
    })

    const end_time = new Date()
    const execution_time = (end_time - start_time) / 1000 // 초 단위
    debug(`처리 시간: ${execution_time}초`)

    // let cost = 0
    // if (calculate_cost === true) {
    //   cost = await this.calculateCost({
    //     model,
    //     input_tokens: input_tokens,
    //     output_tokens: output_tokens,
    //   })
    // }

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

  async test() {
    for (const [name, provider_service] of Object.entries(this.provider_services)) {
      const result = await provider_service.test()
      debug('result', result)
    }
  }
}

const aiService = new AIService()
// aiService.loadModels().then((r) => {
//   aiService.ai_models.forEach(model => {
//     debug('ai_models', model.model)
//   })
// })

export default aiService

// 메인 실행부
// 🇰🇷 메인 실행부입니다.
console.log('import.meta.url', import.meta.url)
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('메인 실행부')
  aiService.test()
}