import axios from 'axios'
import AIServiceBase from '../ai_service_base.js'

/**
 * Runway API를 사용하는 AI 서비스 클래스
 * 비디오 생성 기능 제공
 */
class RunwayService extends AIServiceBase {
  constructor(api_key = process.env.RUNWAY_API_KEY) {
    super('runway')
    this.api_key = api_key

  }

  /**
   * 비디오 생성 (Gen-2)
   * @param {string|Object} input - 프롬프트 텍스트 또는 입력 데이터
   * @param {Object} options - 추가 옵션
   * @returns {Promise<Object>} 응답 객체
   */
  async generateVideo(input, options = {}) {
    try {
      let prompt
      let mode = options.mode || 'text-to-video'

      if (typeof input === 'string') {
        prompt = input
      } else if (typeof input === 'object') {
        prompt = input.prompt
        if (input.image_url) {
          mode = 'image-to-video'
        } else if (input.video_url) {
          mode = 'video-to-video'
        }
      } else {
        return this.formatResponse(
          false,
          null,
          null,
          '유효하지 않은 입력 유형입니다.',
          400
        )
      }

      // 기본 요청 데이터
      const requestData = {
        prompt: prompt
      }

      // 모드에 따른 추가 데이터
      if (mode === 'image-to-video' && input.image_url) {
        requestData.image = input.image_url
      } else if (mode === 'video-to-video' && input.video_url) {
        requestData.video = input.video_url
      }

      // 공통 옵션 추가
      if (options.guidance_scale) requestData.guidance_scale = options.guidance_scale
      if (options.num_frames) requestData.num_frames = options.num_frames
      if (options.num_steps) requestData.num_steps = options.num_steps
      if (options.negative_prompt) requestData.negative_prompt = options.negative_prompt
      if (options.fps) requestData.fps = options.fps

      // API 엔드포인트 결정
      let endpoint
      switch (mode) {
        case 'text-to-video':
          endpoint = 'https://api.runwayml.com/v1/text-to-video'
          break
        case 'image-to-video':
          endpoint = 'https://api.runwayml.com/v1/image-to-video'
          break
        case 'video-to-video':
          endpoint = 'https://api.runwayml.com/v1/video-to-video'
          break
        default:
          endpoint = 'https://api.runwayml.com/v1/text-to-video'
      }

      const response = await axios.post(
        endpoint,
        requestData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.api_key}`
          }
        }
      )

      return this.formatResponse(
        true,
        response.data,
        response.data
      )
    } catch (error) {
      console.error('Runway 비디오 생성 오류:', error.message)
      return this.formatResponse(
        false,
        null,
        null,
        error.message,
        error.response?.status
      )
    }
  }

  /**
   * 생성된 비디오 상태 확인
   * @param {string} generation_id - 생성 ID
   * @returns {Promise<Object>} 응답 객체
   */
  async checkVideoStatus(generation_id) {
    try {
      const response = await axios.get(
        `https://api.runwayml.com/v1/generations/${generation_id}`,
        {
          headers: {
            'Authorization': `Bearer ${this.api_key}`
          }
        }
      )

      return this.formatResponse(
        true,
        response.data,
        response.data
      )
    } catch (error) {
      console.error('Runway 비디오 상태 확인 오류:', error.message)
      return this.formatResponse(
        false,
        null,
        null,
        error.message,
        error.response?.status
      )
    }
  }
}

export default RunwayService 