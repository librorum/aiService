import Debug from 'debug'
const debug = Debug('ai_service:ai_providers:elevenlabs')

import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import AIServiceBase from '../ai_service_base.js'

// 이름 (Voice ID)
// 특징 및 용도
// Taemin (Ir7oQcBXWiq4oFGROCfj)
// 20대 남성, 따뜻하고 자연스러운 톤. 내레이션, 캐주얼 콘텐츠에 적합.
// JiYoung (AW5wrnG1jVizOYY7R1Oo)
// 여성, 친근하고 명확한 발음. 튜토리얼, 교육 콘텐츠에 적합.
// Jjeong (DMkRitQrfpiddSQT5adl)
// 30대 여성, 서울 억양, 차분한 목소리. 유튜브 내레이션에 적합.
// Min-joon (nbrxrAz3eYm9NgojrmFK)
// 젊은 남성, 전문적인 내레이션에 적합.
// Yuna (xi3rF0t7dg7uN2M0WUhr)
// 젊은 여성, 부드럽고 쾌활한 목소리. 스토리텔링에 적합.
// Hyun Bin (s07IwTCOrCDCaETjUVjx)
// 남성, 프로페셔널한 기업 PR 내레이션에 적합.
// Grandfather Namchun (5ON5Fnz24cnOozEQfGAm)


/**
 * ElevenLabs API를 사용하는 AI 서비스 클래스
 * 텍스트-투-스피치 기능 제공
 */
class ElevenLabsService extends AIServiceBase {
  constructor(api_key = process.env.ELEVENLABS_API_KEY) {
    super()
    this.api_key = api_key
    this.client = new ElevenLabsClient({
      apiKey: this.api_key,
    })

    // 지원하는 기능 설정
    this.supports = {
      text: false,
      image: false,
      audio: true,
      video: false
    }

    // 모델 설정

    this.models = [
      {
        model: 'eleven_flash_v2',
        description: '빠른 속도의 모델(50% 저렴)',
      },
      {
        model: 'eleven_multilingual_v2',
        description: '다국어 지원 모델',
      },
    ]

    this.default_tts_model = this.models[0]

    // https://elevenlabs.io/app/voice-library 에서 voice를 검색후 우클릭한 후 "Copy Voice ID" 복사
    this.voices = [
      {
        name: 'Anna Kim',
        id: 'uyVNoMrnUku1dZyVEXwD',
        description: '여성, 친근하고 명확한 발음. 튜토리얼, 교육 콘텐츠에 적합.',
      },
      {
        name: 'KKC RADIO',
        id: 'v1jVu1Ky28piIPEJqRrm',
        description: '여성, 친근하고 명확한 발음. 튜토리얼, 교육 콘텐츠에 적합.',
      },
      {
        name: 'YohanKoo',
        id: '4JJwo477JUAx3HV0T7n7',
        description: '여성, 친근하고 명확한 발음. 튜토리얼, 교육 콘텐츠에 적합.',
      },
    ]

    this.default_voice = this.voices[0]
  }

  /**
   * 텍스트를 음성으로 변환
   * @param {Object} params - 매개변수 객체
   * @param {string} params.prompt - 변환할 텍스트
   * @param {string} params.model - 사용할 모델 (기본값: eleven_multilingual_v2)
   * @param {string} params.voice_id - 사용할 음성 ID
   * @param {string} params.response_format - 응답 형식 (기본값: mp3)
   * @param {string} params.ai_rule - AI 규칙 (사용되지 않음)
   * @returns {Promise<Object>} 응답 객체
   */
  async generateTTS({
    prompt,
    model = this.default_tts_model,
    voice_name = this.default_voice.name,
    response_format = 'mp3',
    ai_rule
  }) {
    try {
      debug('model', model)
      debug('voice_name', voice_name)
      const voice_id = this.voices.find(voice => voice.name === voice_name).id
      debug('voice_id', voice_id)
      const audio = await this.client.textToSpeech.convert(voice_id, {
        text: prompt,
        model_id: model,
      })

      // ElevenLabs는 ReadableStream을 반환하므로 Buffer로 변환
      const chunks = []
      const reader = audio.getReader()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      const audio_buffer = Buffer.concat(chunks)

      return {
        audio: audio_buffer,
        input_tokens: 0, // ElevenLabs는 토큰 기반이 아님
        output_tokens: 0,
        total_tokens: 0,
      }
    } catch (error) {
      console.error('ElevenLabs 오디오 생성 오류:', error.message)
      return {
        error: error.message,
      }
    }
  }

  /**
   * 스트리밍 방식으로 텍스트를 음성으로 변환
   * @param {Object} params - 매개변수 객체
   * @param {string} params.prompt - 변환할 텍스트
   * @param {string} params.model - 사용할 모델
   * @param {string} params.voice_id - 사용할 음성 ID
   * @returns {Promise<ReadableStream>} 오디오 스트림
   */
  async generateTTSStream({
    prompt,
    model = this.default_tts_model,
    voice_id = this.default_voice_id
  }) {
    try {
      const audioStream = await this.client.textToSpeech.convertAsStream(voice_id, {
        text: prompt,
        model_id: model,
      })

      return audioStream
    } catch (error) {
      console.error('ElevenLabs 스트리밍 오디오 생성 오류:', error.message)
      throw error
    }
  }

  /**
   * 사용 가능한 음성 목록 조회
   * @returns {Promise<Object>} 음성 목록
   */
  async getVoices() {
    try {
      const voices = await this.client.voices.getAll()
      return {
        voices: voices.voices,
        error: null
      }
    } catch (error) {
      console.error('ElevenLabs 음성 목록 조회 오류:', error.message)
      return {
        voices: [],
        error: error.message
      }
    }
  }

  /**
   * 특정 음성 정보 조회
   * @param {string} voice_id - 음성 ID
   * @returns {Promise<Object>} 음성 정보
   */
  async getVoice(voice_id) {
    try {
      const voice = await this.client.voices.get(voice_id)
      return {
        voice: voice,
        error: null
      }
    } catch (error) {
      console.error('ElevenLabs 음성 정보 조회 오류:', error.message)
      return {
        voice: null,
        error: error.message
      }
    }
  }
}

export default ElevenLabsService 