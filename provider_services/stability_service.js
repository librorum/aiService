import axios from 'axios'
import AIServiceBase from '../ai_service_base.js'

/**
 * Stability AI API를 사용하는 AI 서비스 클래스
 * 이미지, 비디오 기능 제공
 */
class StabilityService extends AIServiceBase {
  constructor(service, api_key = process.env.STABILITY_API_KEY) {
    super(service, 'stability')
    this.api_key = api_key

    // 모델 설정
    this.default_image_model = 'stable-diffusion-v1-5'
    this.default_video_model = 'stable-video-diffusion'

    // ✅ 주요 엔진 ID 목록
    // 1.	stable-diffusion-v1-5
    // •	가장 널리 사용되는 기본 모델로, 다양한 스타일에 적합합니다.
    // 2.	stable-diffusion-768-v2-1
    // •	해상도 768px에 최적화된 모델로, 더 정밀한 이미지 생성이 가능합니다.
    // 3.	stable-diffusion-xl-1024-v1-0
    // •	고해상도(1024px) 이미지 생성을 지원하며, 세밀한 디테일 표현에 강점이 있습니다. ￼
    // 4.	stable-diffusion-v1-6
    // •	최신 버전으로, 향상된 성능과 품질을 제공합니다.
  }

  async generateImage({
    model = this.default_image_model,
    prompt,
    options,
  }) {
    try {
      const engine_id = model
      const negative_prompt = options.negative_prompt
      const width = options.width || 1024
      const height = options.height || 1024
      const steps = options.steps || 30
      const cfg_scale = options.cfg_scale || 7
      const samples = options.samples || 1

      // 네거티브 프롬프트 지원
      const text_prompts = [
        {
          text: prompt,
          weight: 1
        }
      ]

      if (options.negative_prompt) {
        text_prompts.push({
          text: options.negative_prompt,
          weight: -1
        })
      }

      const response = await axios.post(
        `https://api.stability.ai/v1/generation/${engine_id}/text-to-image`,
        {
          text_prompts: text_prompts,
          cfg_scale: cfg_scale,
          height: height,
          width: width,
          samples: samples,
          steps: steps
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${this.api_key}`
          }
        }
      )

      return {
        image: response.data.artifacts[0].base64,
        input_tokens: response.data.artifacts[0].input_tokens,
        output_tokens: response.data.artifacts[0].output_tokens,
        total_tokens: response.data.artifacts[0].total_tokens,
      }
    } catch (error) {
      console.error('Stability AI 이미지 생성 오류:', error.message)
      return {
        error: error.message,
      }
    }
  }

  /**
   * 비디오 생성
   * @param {string|Object} input - 이미지와 프롬프트를 포함한 객체 또는 이미지 URL
   * @param {Object} options - 추가 옵션
   * @returns {Promise<Object>} 응답 객체
   */
  async generateVideo(input, options = {}) {
    try {
      // 입력이 문자열이면 이미지 URL로 간주
      let image_url
      let prompt = ''

      if (typeof input === 'string') {
        // 입력이 문자열이면 프롬프트로 간주하고 초기 이미지 필요
        prompt = input
        if (!options.image_url) {
          return this.formatResponse(
            false,
            null,
            null,
            'Stability AI 비디오 생성을 위해 options.image_url이 필요합니다.',
            400
          )
        }
        image_url = options.image_url
      } else if (typeof input === 'object') {
        // 입력이 객체이면 이미지와 프롬프트 추출
        if (!input.image_url) {
          return this.formatResponse(
            false,
            null,
            null,
            'Stability AI 비디오 생성을 위해 input.image_url이 필요합니다.',
            400
          )
        }
        image_url = input.image_url
        prompt = input.prompt || ''
      } else {
        return this.formatResponse(
          false,
          null,
          null,
          '유효하지 않은 입력 유형입니다.',
          400
        )
      }

      const motion_strength = options.motion_strength || 0.5
      const frames = options.frames || 25
      const fps = options.fps || 6

      // 비디오 생성 요청
      const response = await axios.post(
        'https://api.stability.ai/v2beta/stable-video/generate',
        {
          video_params: {
            motion_strength: motion_strength,
            frames: frames,
            fps: fps
          },
          text_prompts: [
            {
              text: prompt,
              weight: 1
            }
          ],
          image_url: image_url
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
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
      console.error('Stability AI 비디오 생성 오류:', error.message)
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

export default StabilityService 