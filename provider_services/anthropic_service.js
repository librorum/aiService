import Debug from 'debug'
const debug = Debug('ai_service:ai_providers:anthropic')

import axios from 'axios'
import AIServiceBase from '../ai_service_base.js'
import Anthropic from '@anthropic-ai/sdk'

/**
 * Anthropic API를 사용하는 AI 서비스 클래스
 * 텍스트 기능만 제공 (Claude)
 */
class AnthropicService extends AIServiceBase {
  constructor(api_key = process.env.ANTHROPIC_API_KEY) {
    super('anthropic')
    this.api_key = api_key

    this.client = new Anthropic({
      apiKey: this.api_key,
    })
    // 지원하는 기능 설정
    this.supports = {
      text: true,
      image: false,
      audio: false,
      video: false
    }

    this.models_info = [
      {
        "provider": "anthropic",
        "model": "claude-sonnet-4-0",
        "support_text_output": true,
        "input_token_price_1m": 3.0,
        "output_token_price_1m": 15.0,
        "input_token_price": 0.000003,
        "output_token_price": 0.000015
      },
      {
        "provider": "anthropic",
        "model": "claude-opus-4-0",
        "support_text_output": true,
        "input_token_price_1m": 15.0,
        "output_token_price_1m": 75.0,
        "input_token_price": 0.000015,
        "output_token_price": 0.000075
      },
      // {
      //   "provider": "anthropic",
      //   "model": "claude-3-7-sonnet-latest",
      //   "support_text_output": true,
      //   "input_token_price_1m": 3.0,
      //   "output_token_price_1m": 15.0,
      //   "input_token_price": 0.000003,
      //   "output_token_price": 0.000015
      // },
    ]
    this.text_models = this.models_info.filter(model_info => model_info.support_text_output === true)
    this.image_models = this.models_info.filter(model_info => model_info.support_image_output === true)
    this.tts_models = this.models_info.filter(model_info => model_info.support_tts_output === true)
    this.video_models = this.models_info.filter(model_info => model_info.support_video_output === true)
    this.stt_models = this.models_info.filter(model_info => model_info.support_stt_output === true)
    // 모델 설정
    this.default_text_model = this.text_models[0]
    this.default_image_model = this.image_models[0]
    this.default_tts_model = this.tts_models[0]
    this.default_stt_model = this.stt_models[0]
  }

  /**
   * 텍스트 생성 (Claude)
   * @param {string} prompt - 사용자 프롬프트
   * @param {Object} options - 추가 옵션 (모델, 온도, 최대 토큰 등)
   * @returns {Promise<Object>} 응답 객체
   */
  async generateText({
    prompt,
    model,
    temperature = 0.7,
    max_tokens = 500,
    ai_rule,
    calculate_cost = false
  }) {
    try {
      model = model || this.default_text_model.model
      debug('model', model)

      const messages = [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt
          }
        ]
      }]

      const response = await this.client.messages.create({
        model: model,
        max_tokens: 1000,
        temperature: 1,
        system: ai_rule,
        messages
      })

      return {
        model_used: model,
        text: response.content[0].text,
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
          total_tokens: response.usage.input_tokens + response.usage.output_tokens,
        },
        cost: calculate_cost ? this.calculateCost({
          model,
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        }) : null
      }
    } catch (error) {
      console.error('Anthropic 텍스트 생성 오류:', error.message)
      return {
        error: error.message,
      }
    }
  }
}

export default AnthropicService 