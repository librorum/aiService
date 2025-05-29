import axios from 'axios'
import AIServiceBase from '../ai_service_base.js'
import { GoogleGenAI, Modality } from "@google/genai"
/**
 * Google Gemini API를 사용하는 AI 서비스 클래스
 * 텍스트, 이미지(분석) 기능 제공
 */
class GeminiService extends AIServiceBase {
  constructor(api_key = process.env.GEMINI_API_KEY) {
    super('gemini')
    this.api_key = api_key
    this.client = new GoogleGenAI({
      apiKey: this.api_key,
    })
    // 지원하는 기능 설정
    this.supports = {
      text: true,
      image: true, // 이미지 생성은 아직, 이미지 분석 기능만 제공
      audio: false,
      video: false
    }

    this.modes_info = [
      {
        "model": "gemini-2.5-flash-preview-05-20",
        "support_text_output": true,
        "input_token_price_1m": 0.15,
        "output_token_price_1m": 0.6,
        "input_token_price": 0.00000015,
        "output_token_price": 0.0000006
      },
      {
        "model": "gemini-2.0-flash-preview-image-generation",
        "support_image_output": true,
        "input_token_price_1m": 0.1,
        "output_token_price_1m": 30.0,
        "input_token_price": 0.00000125,
        "output_token_price": 0.00003
      },
      {
        "model": "gemini-2.5-pro-preview-tts",
        "support_tts_output": true,
        "input_token_price_1m": 1.25,
        "output_token_price_1m": 10.0,
        "input_token_price": 0.00000125,
        "output_token_price": 0.00001
      },
      {
        "model": "imagegen",
        "support_tts_output": true,
        "input_token_price_1m": 1.25,
        "output_token_price_1m": 10.0,
        "input_token_price": 0.00000125,
        "output_token_price": 0.00001
      },
      {
        "model": "imagegen",
        "support_tts_output": true,
        "input_token_price_1m": 1.25,
        "output_token_price_1m": 10.0,
        "input_token_price": 0.00000125,
        "output_token_price": 0.00001
      },
    ]
    // https://github.com/danny-avila/LibreChat/discussions/7284?utm_source=chatgpt.com
    // gemini-2.5-pro-preview-05-06 은 rate limit 때문에 사용 불가
    this.text_models = this.modes_info.filter(model_info => model_info.support_text_output === true)
    this.image_models = this.modes_info.filter(model_info => model_info.support_image_output === true)
    this.tts_models = this.modes_info.filter(model_info => model_info.support_tts_output === true)
    this.video_models = this.modes_info.filter(model_info => model_info.support_video_output === true)
    this.stt_models = this.modes_info.filter(model_info => model_info.support_stt_output === true)
    // 모델 설정
    this.default_text_model = this.text_models[0]
    this.default_image_model = this.image_models[0]
    this.default_tts_model = this.tts_models[0]
    this.default_stt_model = this.stt_models[0]
  }

  async generateText({
    prompt,
    model = this.default_text_model.model,
    temperature = 0.7,
    max_tokens = 2048,
    ai_rule,
    calculate_cost = false
  }) {
    try {
      const response = await this.client.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: ai_rule,
          temperature: temperature,
          maxOutputTokens: max_tokens,
        }
      })
      return {
        model_used: model,
        text: response.text,
        usage: {
          input_tokens: response.usageMetadata.promptTokenCount,
          output_tokens: response.usageMetadata.thoughtsTokenCount,
          total_tokens: response.usageMetadata.totalTokenCount,
        },
        cost: calculate_cost ? this.calculateCost({
          model,
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        }) : null

      }
    } catch (error) {
      console.error('Gemini text generation error:', error.message)
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