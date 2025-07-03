import Debug from 'debug'
const debug = Debug('ai_service:ai_providers:openai')

import axios from 'axios'
import AIServiceBase from '../ai_service_base.js'
import OpenAI from 'openai'
/**
 * OpenAI API를 사용하는 AI 서비스 클래스
 * 텍스트, 이미지, 오디오 기능 제공
 */
class OpenAiService extends AIServiceBase {
  constructor(service, api_key = process.env.OPENAI_API_KEY) {
    super(service, 'openai')
    this.api_key = api_key
    this.client = new OpenAI({
      apiKey: this.api_key,
    })

    this.models_info = [
      {
        model: 'gpt-4.1',
        support_text_output: true,
        support_web_search: true,
        support_tool: true,
        input_token_price_1m: 2.0,
        output_token_price_1m: 8.0,
        input_token_price: 0.000002,
        output_token_price: 0.000008
      },
      {
        model: 'gpt-4o',
        support_text_output: true,
        support_web_search: true,
        support_tool: true,
        input_token_price_1m: 2.5,
        output_token_price_1m: 10.0,
        input_token_price: 0.0000025,
        output_token_price: 0.00001
      },
      {
        model: 'gpt-image-1',
        support_image_output: true,
        input_token_price_1m: 5,
        image_input_token_price_1m: 10,
        output_token_price_1m: 40,
        input_token_price: 0.000005,
        output_token_price: 0.00004
      },
      {
        model: 'gpt-4o-mini-tts',
        support_tts_output: true,
        input_token_price_1m: 0.6,
        output_token_price_1m: 12,
        input_token_price: 0.0000006,
        output_token_price: 0.000012
      },
      {
        // 1분당 0.006$
        model: 'whisper',
        support_stt_output: true,
      },
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

    service.registerTool({
      name: 'image_generator',
      description: '이미지 생성',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'The prompt for image generation',
          },
        },
        required: ['prompt'],
        additionalProperties: false,
      },
      func: async ({ prompt, model = this.default_image_model.model, width, height, n = 1 }) => {
        return await this.generateImage({ prompt, model, width, height, n })
      }
    })
  }

  /**
   * 텍스트 생성 - OpenAI Responses API를 사용하여 모든 요청을 처리
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
    system_tools = [], // ['web_search']
    user_tools = [],
    conversation_history = null, // 기존 방식 - Responses API로 변환
    use_conversation_state = false, // 새로운 Responses API 사용 여부
    previous_response_id = null, // 이전 응답 ID (Responses API용)
  }) {
    try {
      model = model || this.default_text_model.model
      debug('model', model)

      // 입력 구성
      let input

      if (use_conversation_state && previous_response_id) {
        // Conversation State 방식: 이전 응답 ID가 있으면 새 메시지만 전송
        input = [{ role: 'user', content: prompt }]
      } else if (conversation_history && conversation_history.length > 0) {
        // 기존 방식: conversation_history를 Responses API 형식으로 변환
        input = [...conversation_history, { role: 'user', content: prompt }]
      } else {
        // 첫 번째 메시지인 경우
        const messages = []
        if (ai_rule) {
          messages.push({ role: 'system', content: ai_rule })
        }
        messages.push({ role: 'user', content: prompt })
        input = messages
      }

      const request = {
        model,
        input,
        temperature
        // max_tokens는 Responses API에서 지원하지 않음
        // max_completion_tokens도 현재 지원하지 않는 것으로 보임
      }

      if (previous_response_id) {
        request.previous_response_id = previous_response_id
      }

      // Tools 설정 (기존 로직과 동일)
      let tools = []
      if (system_tools.length > 0) {
        tools = [...system_tools.map(tool_name => {
          if (tool_name === 'web_search') {
            return {
              type: 'web_search_preview'
            }
          }
        }).filter(tool => tool)]
      }

      if (user_tools.length > 0) {
        const function_tools = user_tools.map(tool_name => {
          const tool = this.tools[tool_name]
          if (tool) {
            return {
              type: 'function',
              function: tool
            }
          }
          return null
        }).filter(tool => tool !== null)

        tools = [...tools, ...function_tools]
      }

      if (tools.length > 0) {
        request.tools = tools
      }

      // Responses API 호출
      const response = await this.client.responses.create(request)

      // conversation_history 업데이트 (기존 방식 호환성을 위해)
      let updated_conversation_history = null
      if (use_conversation_state !== true) {
        // Conversation State를 명시적으로 사용하지 않는 경우 conversation_history 업데이트
        updated_conversation_history = conversation_history ? [...conversation_history] : []
        if (ai_rule && updated_conversation_history.length === 0) {
          updated_conversation_history.push({ role: 'system', content: ai_rule })
        }
        updated_conversation_history.push({ role: 'user', content: prompt })
        updated_conversation_history.push({ role: 'assistant', content: response.output_text })
      }

      return {
        model_used: model,
        text: response.output_text,
        usage: {
          input_tokens: response.usage?.input_tokens || 0,
          output_tokens: response.usage?.output_tokens || 0,
          total_tokens: response.usage?.total_tokens || 0,
        },
        cost: this.calculateCost({
          model,
          input_tokens: response.usage?.input_tokens || 0,
          output_tokens: response.usage?.output_tokens || 0,
        }),
        response_id: response.id, // 다음 요청에서 사용할 수 있도록 응답 ID 반환
        updated_conversation_history: updated_conversation_history // 기존 방식 호환성
      }
    } catch (error) {
      console.error('OpenAI 텍스트 생성 오류:', error.message)
      return {
        text: '',
        error: error.message,
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
        cost: 0,
        model_used: model
      }
    }
  }

  async generateImage({
    model = this.default_image_model.model,
    prompt,
    width,
    height,
    n = 1,
  }) {
    try {
      let size
      if (width == null || height == null) {
        size = 'auto'
      } else {
        size = `${width}x${height}`
      }

      const response = await this.client.images.generate({
        model,
        prompt,
        n,
        size,
        quality: 'auto', // low, medium, high
      })

      return {
        model_used: model,
        image: response.data[0].b64_json,
        image_type: 'base64',
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
          total_tokens: response.usage.total_tokens,
        },
        cost: this.calculateCost({
          model,
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        }),
      }
    } catch (error) {
      console.error('OpenAI 이미지 생성 오류:', error.message)
      return {
        error: error.message,
      }
    }
  }

  async generateTTS({
    model = this.default_tts_model.model,
    prompt,
    voice = 'sage',
    response_format = 'mp3',
    ai_rule,
  }) {
    try {
      const response = await this.client.audio.speech.create({
        model,
        input: prompt,
        voice,
        instructions: ai_rule,
        response_format,
      })
      // const mp3 = await this.client.audio.speech.create({
      //   model: "gpt-4o-mini-tts",
      //   voice: "alloy",
      //   input: "Today is a wonderful day to build something people love!",
      // })
      // Audio API는 ArrayBuffer로 바이너리 오디오 데이터를 반환
      const audio_buffer = Buffer.from(await response.arrayBuffer())
      return {
        audio: audio_buffer,
        usage: {
          input_tokens: response.usage?.input_tokens || 0,
          output_tokens: response.usage?.output_tokens || 0,
          total_tokens: response.usage?.total_tokens || 0,
        },
        cost: this.calculateCost({
          model,
          input_tokens: response.usage?.input_tokens || 0,
          output_tokens: response.usage?.output_tokens || 0,
        }),
        model_used: model,
      }
    } catch (error) {
      console.error('OpenAI 오디오 처리 오류:', error.message)
      return {
        error: error.message,
      }
    }
  }
}

export default OpenAiService 
