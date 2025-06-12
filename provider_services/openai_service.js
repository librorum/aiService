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
  constructor(api_key = process.env.OPENAI_API_KEY) {
    super('openai')
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

    this.registerTool({
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
   * 텍스트 생성 (챗 컴플리션)
   * @param {string} prompt - 사용자 프롬프트
   * @param {Object} options - 추가 옵션 (모델, 온도, 최대 토큰 등)
   * @returns {Promise<Object>} 응답 객체
   */
  async generateText({
    prompt,
    model = this.default_text_model.model,
    temperature = 0.7,
    max_tokens = 500,
    ai_rule,
    system_tools = [], // ['web_search']
    user_tools = [],
  }) {
    try {
      const messages = []
      if (ai_rule) {
        messages.push({ role: 'developer', content: ai_rule })
      }
      messages.push({ role: 'user', content: prompt })

      let request = {
        model,
        input: messages,
        // temperature: temperature,
        // max_tokens: max_tokens
      }
      // tool_choice: "auto" : default , Call zero, one, or multiple functions. 
      // tool_choice: "required" : 
      // tool_choice: { "type": "web_search_preview" } : Call exactly one specific function.
      // tool_choice: "none" : 근데 이건 어차피 tool을 안주면 되는 거라 같음
      let tools = []
      if (system_tools.length > 0) {
        tools = [...system_tools.map(tool_name => {
          if (tool_name === 'web_search') {
            request.tool_choice = { "type": "web_search_preview" }
            return { type: "web_search_preview" }
          }
          return { type: tool_name }
        }).filter(tool => tool !== null)
        ]
      }
      if (user_tools.length > 0) {
        tools = [...tools, ...user_tools.map(tool_name => {
          const tool = this.tools[tool_name]
          if (tool) {
            return {
              type: 'function',
              ...tool,
              // strict: true,
            }
          }
          return null
        }).filter(tool => tool !== null)
        ]
      }
      if (tools.length > 0) {
        request.tools = tools
        debug('tools', JSON.stringify(tools, null, 2))
      } else {
        debug('no tools')
      }
      // tools.push({
      //   type: 'function',
      //   ...this.tools['image_generator']
      // })
      debug('request', JSON.stringify(request, null, 2))
      const response = await this.client.responses.create(request)
      debug('response', JSON.stringify(response, null, 2))

      let response_text = response.output_text || ''
      let response_tools = []

      // 함수 호출 처리
      if (response.output && Array.isArray(response.output)) {
        for (const output of response.output) {
          if (output.type === 'function_call' && output.status === 'completed') {
            response_tools.push(output.name)
            const func = this.functions[output.name]
            if (func) {
              const function_call = func(JSON.parse(output.arguments))
              const function_result = function_call instanceof Promise ? await function_call : function_call
              debug('ƒƒƒ function_result', function_result)
              if (function_result instanceof Object && function_result.image != null) {
                let cost = this.calculateCost({
                  model,
                  input_tokens: response.usage.input_tokens,
                  output_tokens: response.usage.output_tokens,
                })
                cost.input_cost += function_result.cost.input_cost
                cost.output_cost += function_result.cost.output_cost
                cost.total_cost_usd += function_result.cost.total_cost_usd
                cost.total_cost_krw += function_result.cost.total_cost_krw
                return {
                  model_used: model,
                  image: function_result.image,
                  image_type: function_result.image_type,
                  usage: function_result.usage,
                  cost: cost,
                }
              }

              request.input.push(output)
              request.input.push({
                type: "function_call_output",
                call_id: output.call_id,
                output: function_result.toString()
              })
            }
          }
        }
        const response2 = await this.client.responses.create(request)
        response_text += response2.output_text || ''
      }

      // 함수 실행 및 결과 텍스트에 포함
      // if (response_tools.length > 0) {
      // }

      return {
        model_used: model,
        text: response_text,
        tools: response_tools,
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
          total_tokens: response.usage.total_tokens,
        },
        cost: this.calculateCost({
          model,
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        })
      }
    } catch (error) {
      console.error('OpenAI 텍스트 생성 오류:', error.message)
      return {
        error: error.message,
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