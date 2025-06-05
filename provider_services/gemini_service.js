import Debug from 'debug'
const debug = Debug('ai_service:ai_providers:gemini')

import axios from 'axios'
import AIServiceBase from '../ai_service_base.js'
import { GoogleGenAI, Type, Modality } from '@google/genai'
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
        model: "gemini-2.0-flash-preview-image-generation",
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
      // Tool 설정
      const tools = []
      if (system_tools.length > 0) {
        system_tools.forEach(tool_name => {
          if (tool_name === 'web_search') {
            tools.push({ googleSearchRetrieval: {} })
          }
        })
      }

      if (user_tools.length > 0) {
        const function_declarations = user_tools.map(tool_name => {
          const tool = this.tools[tool_name]
          if (tool) {
            // Gemini용 parameters 변환 (additionalProperties 제거)
            const gemini_parameters = { ...tool.parameters }
            delete gemini_parameters.additionalProperties

            return {
              name: tool.name,
              description: tool.description,
              parameters: gemini_parameters
            }
          }
          return null
        }).filter(tool => tool !== null)

        if (function_declarations.length > 0) {
          tools.push({ functionDeclarations: function_declarations })
        }
      }

      const genAI = this.client

      // API 호출 매개변수 설정
      const request_params = {
        model: model,
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
      }

      // Tools가 있으면 config에 추가
      if (tools.length > 0) {
        request_params.config = {
          tools: tools,
          generationConfig: {
            temperature: temperature,
            maxOutputTokens: max_tokens,
          }
        }
      } else {
        request_params.config = {
          generationConfig: {
            temperature: temperature,
            maxOutputTokens: max_tokens,
          }
        }
      }

      // System instruction이 있으면 추가
      if (ai_rule) {
        request_params.config.systemInstruction = ai_rule
      }

      debug('Gemini request params:', JSON.stringify(request_params, null, 2))

      const result = await genAI.models.generateContent(request_params)

      debug('Gemini response:', JSON.stringify(result, null, 2))

      if (!result || !result.candidates || !result.candidates[0]) {
        throw new Error('Invalid response from Gemini API')
      }

      let response_text = ''
      let response_tools = []

      // 텍스트 응답 처리 - candidates에서 직접 추출
      if (result.candidates && result.candidates[0] && result.candidates[0].content) {
        const parts = result.candidates[0].content.parts || []
        for (const part of parts) {
          if (part.text) {
            response_text += part.text
          }
        }
      }

      // Function call 처리
      if (result.candidates && result.candidates[0] && result.candidates[0].content) {
        const parts = result.candidates[0].content.parts || []
        for (const part of parts) {
          if (part.functionCall) {
            response_tools.push({
              name: part.functionCall.name,
              parameters: part.functionCall.args || {}
            })

            // 함수 실행
            const func = this.functions[part.functionCall.name]
            if (func) {
              const function_result = await func(part.functionCall.args || {})
              if (response_text) {
                response_text += `\n${function_result}`
              } else {
                response_text = function_result
              }
            }
          }
        }
      }

      const usage = result.usageMetadata || {}

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
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
        }
      })

      const images = []
      for (const part of response.candidates[0].content.parts) {
        // 이미지 데이터 추출
        if (part.inlineData) {
          const imageData = part.inlineData.data
          const image_buffer = Buffer.from(imageData, "base64")
          images.push(image_buffer)
        }
      }

      if (images.length === 0) {
        return {
          error: "No images found in response",
        }
      }

      const result = {
        image: images[0], // 첫 번째 이미지만 반환
        input_tokens: response.usageMetadata.promptTokenCount,
        output_tokens: response.usageMetadata.candidatesTokenCount,
        total_tokens: response.usageMetadata.totalTokenCount,
      }
      return result
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