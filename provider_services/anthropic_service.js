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
  constructor(context, api_key = process.env.ANTHROPIC_API_KEY) {
    super(context, 'anthropic')
    this.api_key = api_key

    this.client = new Anthropic({
      apiKey: this.api_key,
    })

    this.models_info = [
      {
        provider: "anthropic",
        model: "claude-sonnet-4-0",
        support_text_output: true,
        support_web_search: true,
        support_tool: true,
        input_token_price_1m: 3.0,
        output_token_price_1m: 15.0,
        input_token_price: 0.000003,
        output_token_price: 0.000015
      },
      {
        provider: "anthropic",
        model: "claude-opus-4-0",
        support_text_output: true,
        support_web_search: true,
        support_tool: true,
        input_token_price_1m: 15.0,
        output_token_price_1m: 75.0,
        input_token_price: 0.000015,
        output_token_price: 0.000075
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
    system_tools = [], // ['web_search']
    user_tools = [],
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

      let request = {
        model: model,
        max_tokens: 1000,
        temperature: 1,
        system: ai_rule,
        messages
      }

      // system_tools와 user_tools를 처리
      let tools = []
      if (system_tools.length > 0) {
        tools = [...system_tools.map(tool_name => {
          if (tool_name === 'web_search') {
            request.tool_choice = { type: "tool", name: 'web_search' }
            return {
              type: "web_search_20250305",
              name: "web_search",
            }
          }
          return null
        }).filter(tool => tool !== null)]
      }

      if (user_tools.length > 0) {
        tools = [...tools, ...user_tools.map(tool_name => {
          const tool = this.tools[tool_name]

          if (tool) {
            let input_schema = JSON.parse(JSON.stringify(tool.parameters))
            delete input_schema.additionalProperties
            return {
              name: tool.name,
              description: tool.description,
              input_schema
            }
          }
          return null
        }).filter(tool => tool !== null)]
      }

      if (tools.length > 0) {
        request.tools = tools
        debug('tools', JSON.stringify(tools, null, 2))
      } else {
        debug('no tools')
      }

      const response1 = await this.client.messages.create(request)
      debug('response1', JSON.stringify(response1, null, 2))
      let response_text = ''
      let response_tools = []

      response_text = (response1.content.find(block => block.type === 'text'))?.text || ''
      if (response1.stop_reason === 'tool_use') {
        const tool_use_blocks = response1.content.filter(block => block.type === 'tool_use')
        const tool_results = []
        for (const tool_use of tool_use_blocks) {
          response_tools.push(tool_use.name)
          debug(`- 도구: ${tool_use.name}`)
          debug(`- 파라미터:`, tool_use.input)
          const func = this.functions[tool_use.name]
          if (func) {
            const function_call = func(tool_use.input)
            const function_result = function_call instanceof Promise ? await function_call : function_call
            debug('ƒƒƒ function_result', function_result)
            tool_results.push({
              tool_use_id: tool_use.id,
              content: function_result.toString(),
              is_error: false
            })
          }
        }

        // tool_result를 위한 새로운 요청 생성
        const tool_request = {
          model: model,
          max_tokens: 4096,
          messages: [
            ...request.messages,
            {
              role: 'assistant',
              content: response1.content
            },
            {
              role: 'user',
              content: tool_results.map(result => ({
                type: "tool_result",
                tool_use_id: result.tool_use_id,
                content: result.content,
                is_error: result.is_error || false
              }))
            }
          ]
        }

        // 추가 툴 요청이 있을지 여부는 모른다.
        // if (tools.length > 0) {
        //   tool_request.tools = tools
        // }

        const response2 = await this.client.messages.create(tool_request)
        response_text += (response2.content.find(block => block.type === 'text'))?.text || ''
      }

      return {
        model_used: model,
        text: response_text,
        tools: response_tools,
        usage: {
          input_tokens: response1.usage.input_tokens,
          output_tokens: response1.usage.output_tokens,
          total_tokens: response1.usage.input_tokens + response1.usage.output_tokens,
        },
        cost: this.calculateCost({
          model,
          input_tokens: response1.usage.input_tokens,
          output_tokens: response1.usage.output_tokens,
        })
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