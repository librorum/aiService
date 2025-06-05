import Debug from 'debug'
const debug = Debug('ai_service:ai_providers:gemini')

import axios from 'axios'
import AIServiceBase from '../ai_service_base.js'
import { GoogleGenAI, Type } from '@google/genai'
/**
 * Google Gemini API를 사용하는 AI 서비스 클래스
 * 텍스트, 이미지, Function Calling 기능 제공
 */
// console.log('type string', Type.STRING)
// console.log('type array', Type.ARRAY)
class GeminiService extends AIServiceBase {
  constructor(api_key = process.env.GEMINI_API_KEY) {
    super('gemini')
    this.api_key = api_key
    this.client = new GoogleGenAI(this.api_key)

    this.models_info = [
      {
        model: "gemini-2.0-flash-exp",
        support_text_output: true,
        support_web_search: true,
        support_tool: true,
        input_token_price_1m: 0.075,
        output_token_price_1m: 0.3,
        input_token_price: 0.000000075,
        output_token_price: 0.0000003
      },
      // {
      //   model: "gemini-1.5-pro",
      //   support_text_output: true,
      //   support_web_search: true,
      //   support_tool: true,
      //   input_token_price_1m: 1.25,
      //   output_token_price_1m: 5.0,
      //   input_token_price: 0.00000125,
      //   output_token_price: 0.000005
      // },
      // {
      //   model: "gemini-2.0-flash-thinking-exp",
      //   support_text_output: true,
      //   support_web_search: true,
      //   support_tool: true,
      //   input_token_price_1m: 0.075,
      //   output_token_price_1m: 0.3,
      //   input_token_price: 0.000000075,
      //   output_token_price: 0.0000003
      // },
      {
        model: "imagen-3.0-generate-001",
        support_image_output: true,
        input_token_price_1m: 0.04,
        output_token_price_1m: 0.08,
        input_token_price: 0.00000004,
        output_token_price: 0.00000008
      }
    ]

    this.text_models = this.models_info.filter(model_info => model_info.support_text_output === true)
    this.image_models = this.models_info.filter(model_info => model_info.support_image_output === true)
    this.tts_models = this.models_info.filter(model_info => model_info.support_tts_output === true)
    this.video_models = this.models_info.filter(model_info => model_info.support_video_output === true)
    this.stt_models = this.models_info.filter(model_info => model_info.support_stt_output === true)

    // 기본 모델 설정
    this.default_text_model = this.text_models[0]
    this.default_image_model = this.image_models[0]
    this.default_tts_model = this.tts_models[0]
    this.default_stt_model = this.stt_models[0]
  }

  /**
   * 텍스트 생성 (Function Calling 지원)
   * @param {string} prompt - 사용자 프롬프트
   * @param {Object} options - 추가 옵션
   * @returns {Promise<Object>} 응답 객체
   */
  async generateText({
    prompt,
    model = this.default_text_model.model,
    temperature = 0.7,
    max_tokens = 2048,
    ai_rule,
    calculate_cost = false,
    system_tools = [], // ['web_search']
    user_tools = [],
  }) {
    try {
      const messages = []
      if (ai_rule) {
        messages.push({ role: 'system', content: ai_rule })
      }
      messages.push({ role: 'user', content: prompt })

      // Tool 설정
      const tools = []
      if (system_tools.length > 0) {
        tools.push(...system_tools.map(tool_name => {
          if (tool_name === 'web_search') {
            return { googleSearch: {} }
          }
          return null
        }).filter(tool => tool !== null))
      }

      if (user_tools.length > 0) {
        tools.push(...user_tools.map(tool_name => {
          const tool = this.tools[tool_name]
          if (tool) {
            // Gemini용 parameters 변환 (additionalProperties 제거)
            const gemini_parameters = { ...tool.parameters }
            delete gemini_parameters.additionalProperties

            return {
              function_declarations: [{
                name: tool.name,
                description: tool.description,
                parameters: gemini_parameters
              }]
            }
          }
          return null
        }).filter(tool => tool !== null))
      }

      const genAI = this.client
      const geminiModel = genAI.getGenerativeModel({
        model: model,
        tools: tools.length > 0 ? tools : undefined,
        systemInstruction: ai_rule,
        generationConfig: {
          temperature: temperature,
          maxOutputTokens: max_tokens,
        }
      })

      debug('Gemini request:', { model, prompt, tools: tools.length })

      const result = await geminiModel.generateContent(prompt)
      const response = result.response

      let response_text = response.text() || ''
      let response_tools = []

      // Function call 처리  
      const functionCalls = response.functionCalls()
      if (functionCalls && functionCalls.length > 0) {
        for (const call of functionCalls) {
          response_tools.push({
            name: call.name,
            parameters: call.args
          })

          // 함수 실행
          const func = this.functions[call.name]
          if (func) {
            const function_result = await func(call.args)
            if (response_text) {
              response_text += `\n${function_result}`
            } else {
              response_text = function_result
            }
            debug('ƒƒƒ function_result', function_result)
          }
        }
      }

      const usage = response.usageMetadata || {}

      return {
        model_used: model,
        text: response_text,
        tools: response_tools,
        usage: {
          input_tokens: usage.promptTokenCount || 0,
          output_tokens: usage.candidatesTokenCount || 0,
          total_tokens: usage.totalTokenCount || 0,
        },
        cost: calculate_cost ? this.calculateCost({
          model,
          input_tokens: usage.promptTokenCount || 0,
          output_tokens: usage.candidatesTokenCount || 0,
        }) : null
      }
    } catch (error) {
      console.error('Gemini 텍스트 생성 오류:', error.message)
      debug('Gemini error details:', error)
      return {
        error: error.message,
      }
    }
  }

  async generateImage({
    model = this.default_image_model.model,
    prompt,
    width = 1024,
    height = 1024,
    n = 1,
  }) {
    try {
      const response = await this.client.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        }
      })

      for (const part of response.candidates[0].content.parts) {
        // Based on the part type, either show the text or save the image
        if (part.text) {
          console.log(part.text)
        } else if (part.inlineData) {
          const imageData = part.inlineData.data
          const image_buffer = Buffer.from(imageData, "base64")
          return {
            image: image_buffer,
            input_tokens: response.usageMetadata.promptTokenCount,
            output_tokens: response.usageMetadata.candidatesTokenCount,
            total_tokens: response.usageMetadata.totalTokenCount,
          }
        }
      }
    } catch (error) {
      console.error('Gemini 이미지 생성 오류:', error.message)
      return {
        error: error.message,
      }
    }
  }

  async editImage({
    model = this.default_image_model,
    source_image,
    width = 1024,
    height = 1024,
    n = 1,
  }) {
  }
}

export default GeminiService