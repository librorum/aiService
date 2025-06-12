import Debug from 'debug'
const debug = Debug('ai_service:ai_providers:gemini')

import axios from 'axios'
import AIServiceBase from '../ai_service_base.js'
import { GoogleGenAI, Type, Modality } from '@google/genai'

/**
 * Google Gemini API를 사용하는 AI 서비스 클래스
 * 텍스트, 이미지, Function Calling, TTS 기능 제공
 * 
 * TTS 기능: listVoices() 함수로 지원 음성 및 언어 확인 가능
 * 전체 음성 옵션 테스트: https://aistudio.google.com/generate-speech
 */
class GeminiService extends AIServiceBase {
  constructor(api_key = process.env.GEMINI_API_KEY) {
    super('gemini')
    this.api_key = api_key
    this.client = new GoogleGenAI(this.api_key)

    this.models_info = [
      {
        model: "gemini-2.5-pro-preview-06-05",
        support_text_output: true,
        support_web_search: true,
        support_tool: true,
        calc_func: (input_tokens, output_tokens) => {
          if (input_tokens <= 200_000) {
            const input_cost_1m = 1.25
            const output_cost_1m = 10.0
            const input_token_price = input_cost_1m / 1_000_000
            const output_token_price = output_cost_1m / 1_000_000
            return {
              input_cost: input_tokens * input_token_price,
              output_cost: output_tokens * output_token_price
            }
          } else {
            const input_cost_1m = 2.5
            const output_cost_1m = 15.0
            const input_token_price = input_cost_1m / 1_000_000
            const output_token_price = output_cost_1m / 1_000_000
            return {
              input_cost: input_tokens * input_token_price,
              output_cost: output_tokens * output_token_price
            }
          }
        },
      },
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
        model: 'gemini-2.0-flash-preview-image-generation',
        support_image_output: true,
        input_token_price_1m: 0.04,
        output_token_price_1m: 0.08,
        input_token_price: 0.00000004,
        output_token_price: 0.00000008
      },
      //TODO VertexAI 에서 해야함.
      // {
      //   model: 'imagen-3.0-generate-002',
      //   support_image_output: true,
      //   calc_func: (input_tokens, output_tokens) => {
      //     return {
      //       total_cost_usd: 0.04,
      //       total_cost_krw: 0.06 * usd_to_krw,
      //     }
      //   }
      // },
      {
        model: 'gemini-2.5-flash-preview-tts',
        support_tts_output: true,
        input_token_price_1m: 0.5,
        output_token_price_1m: 10.00,
        input_token_price: 0.0000005,
        output_token_price: 0.00001
      },
      {
        model: 'gemini-2.5-pro-preview-tts',
        support_tts_output: true,
        input_token_price_1m: 1.0,
        output_token_price_1m: 20.00,
        input_token_price: 0.000001,
        output_token_price: 0.00002
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
        cost: this.calculateCost({
          model,
          input_tokens: usage.promptTokenCount || 0,
          output_tokens: usage.candidatesTokenCount || 0,
        })
      }
    } catch (error) {
      console.error('Gemini 텍스트 생성 오류:', error.message)
      debug('Gemini error details:', error)
      return {
        error: error.message,
      }
    }
  }

  /**
   * 텍스트를 음성으로 변환 (TTS)
   * @param {string} prompt - 음성으로 변환할 텍스트
   * @param {Object} options - 추가 옵션
   * @returns {Promise<Object>} 오디오 버퍼와 메타데이터
   */
  async generateTTS({
    model = this.default_tts_model.model,
    prompt,
    voice = 'Kore',
    response_format = 'wav',
    ai_rule,
  }) {
    try {
      const contents = [{
        parts: [{ text: prompt }]
      }]

      // 시스템 지시사항이 있으면 프롬프트에 포함
      if (ai_rule) {
        contents[0].parts[0].text = `${ai_rule}\n\n${prompt}`
      }

      const response = await this.client.models.generateContent({
        model,
        contents,
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice,
              },
            },
          },
        }
      })

      // 오디오 데이터 추출
      const audio_b64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data
      if (!audio_b64) {
        throw new Error('오디오 데이터를 가져올 수 없습니다')
      }

      // // Base64에서 Buffer로 변환
      // const audioBuffer = Buffer.from(audioData, 'base64')

      const usage = response.usageMetadata || {}
      const cost = this.calculateCost({
        model,
        input_tokens: usage.promptTokenCount || 0,
        output_tokens: usage.candidatesTokenCount || 0,
      })

      return {
        audio: audio_b64,
        audio_type: 'base64',
        usage: {
          input_tokens: usage.promptTokenCount || 0,
          output_tokens: usage.candidatesTokenCount || 0,
          total_tokens: usage.totalTokenCount || 0,
        },
        cost,
        model_used: model,
      }
    } catch (error) {
      console.error('Gemini TTS 오류:', error.message)
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
          images.push(part.inlineData.data)
        }
      }

      if (images.length === 0) {
        return {
          error: "No images found in response",
        }
      }

      const cost = this.calculateCost({
        model,
        input_tokens: response.usageMetadata.promptTokenCount,
        output_tokens: response.usageMetadata.candidatesTokenCount,
      })

      const result = {
        image: images[0], // 첫 번째 이미지만 반환
        image_type: 'base64',
        model_used: model,
        usage: {
          input_tokens: response.usageMetadata.promptTokenCount,
          output_tokens: response.usageMetadata.candidatesTokenCount,
          total_tokens: response.usageMetadata.totalTokenCount,
        },
        cost
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

  /**
   * Gemini TTS의 지원 음성, 언어, 모델 정보 반환
   * @returns {Object} TTS 지원 정보
   */
  listVoices() {
    return {
      voices: [
        { name: 'Zephyr', description: '서풍의 신, 부드럽고 상쾌한 음성' },
        { name: 'Puck', description: '요정의 이름, 장난스럽고 밝은 음성' },
        { name: 'Charon', description: '저승사자, 깊고 무게감 있는 음성' },
        { name: 'Kore', description: '페르세포네의 다른 이름, 기본 권장 음성', recommended: true },
        { name: 'Fenrir', description: '늑대의 신, 힘차고 강인한 음성' },
        { name: 'Leda', description: '그리스 신화 여왕, 우아하고 품격 있는 음성' },
        { name: 'Orus', description: '고대 이집트 신, 권위적이고 신비로운 음성' },
        { name: 'Aoede', description: '음악의 뮤즈, 멜로디컬하고 아름다운 음성' },
        { name: 'Callirhoe', description: '강의 님프, 유려하고 감미로운 음성' },
        { name: 'Autonoe', description: '사냥의 님프, 명료하고 선명한 음성' },
        { name: 'Enceladus', description: '거대한 타이탄, 웅장하고 깊은 음성' },
        { name: 'Iapetus', description: '타이탄의 신, 원시적이고 강렬한 음성' },
        { name: 'Umbriel', description: '천왕성의 달, 신비롭고 차분한 음성' },
        { name: 'Algieba', description: '사자자리 별, 위엄 있고 당당한 음성' },
        { name: 'Despina', description: '해왕성의 달, 몽환적이고 부드러운 음성' },
        { name: 'Erinome', description: '목성의 달, 섬세하고 여린 음성' },
        { name: 'Algenib', description: '페가수스자리 별, 역동적이고 활기찬 음성' },
        { name: 'Rasalgethi', description: '헤르쿨레스자리 별, 영웅적이고 씩씩한 음성' },
        { name: 'Laomedeia', description: '해왕성의 달, 현명하고 침착한 음성' },
        { name: 'Achernar', description: '에리다누스자리 별, 밝고 빠른 음성' },
        { name: 'Alnilam', description: '오리온자리 별, 정확하고 명확한 음성' },
        { name: 'Schedar', description: '카시오페이아자리 별, 화려하고 극적인 음성' },
        { name: 'Gacrux', description: '남십자자리 별, 따뜻하고 포근한 음성' },
        { name: 'Pulcherrima', description: '쌍둥이자리 별, 아름답고 매력적인 음성' },
        { name: 'Achird', description: '카시오페이아자리 별, 단단하고 믿음직한 음성' },
        { name: 'Zubenelgenubi', description: '천칭자리 별, 균형 잡히고 중성적인 음성' },
        { name: 'Vindemiatrix', description: '처녀자리 별, 정숙하고 온화한 음성' },
        { name: 'Sadachbia', description: '물병자리 별, 시원하고 상쾌한 음성' },
        { name: 'Sadaltager', description: '물병자리 별, 혁신적이고 미래적인 음성' },
        { name: 'Sulafar', description: '돌고래자리 별, 경쾌하고 친근한 음성' }
      ],
      languages: [
        { code: 'ar-EG', name: '아랍어 (이집트)' },
        { code: 'de-DE', name: '독일어 (독일)' },
        { code: 'en-US', name: '영어 (미국)' },
        { code: 'es-US', name: '스페인어 (미국)' },
        { code: 'fr-FR', name: '프랑스어 (프랑스)' },
        { code: 'hi-IN', name: '힌디어 (인도)' },
        { code: 'id-ID', name: '인도네시아어 (인도네시아)' },
        { code: 'it-IT', name: '이탈리아어 (이탈리아)' },
        { code: 'ja-JP', name: '일본어 (일본)' },
        { code: 'ko-KR', name: '한국어 (한국)', highlight: true },
        { code: 'pt-BR', name: '포르투갈어 (브라질)' },
        { code: 'ru-RU', name: '러시아어 (러시아)' },
        { code: 'nl-NL', name: '네덜란드어 (네덜란드)' },
        { code: 'pl-PL', name: '폴란드어 (폴란드)' },
        { code: 'th-TH', name: '태국어 (태국)' },
        { code: 'tr-TR', name: '터키어 (터키)' },
        { code: 'vi-VN', name: '베트남어 (베트남)' },
        { code: 'ro-RO', name: '루마니아어 (루마니아)' },
        { code: 'uk-UA', name: '우크라이나어 (우크라이나)' },
        { code: 'bn-BD', name: '벵골어 (방글라데시)' },
        { code: 'en-IN', name: '영어 (인도)' },
        { code: 'mr-IN', name: '마라티어 (인도)' },
        { code: 'ta-IN', name: '타밀어 (인도)' },
        { code: 'te-IN', name: '텔루구어 (인도)' }
      ],
      models: [
        {
          name: 'gemini-2.5-flash-preview-tts',
          description: '빠른 응답, 비용 효율적',
          recommended: true
        },
        {
          name: 'gemini-2.5-pro-preview-tts',
          description: '고품질, 높은 정확도'
        }
      ],
      limitations: {
        inputType: '텍스트만 지원',
        contextWindow: '32,000 토큰',
        outputFormat: 'WAV (PCM, 24kHz, 16-bit)',
        languageDetection: '자동 감지'
      },
      testUrl: 'https://aistudio.google.com/generate-speech'
    }
  }
}

export default GeminiService