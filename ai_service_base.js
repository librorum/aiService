import Debug from 'debug'
const debug = Debug('ai_service:ai_service_base')
import fs from 'fs/promises'
/**
 * AI 서비스 제공자를 위한 기본 클래스
 * 모든 AI 서비스 구현체는 이 클래스를 상속해야 합니다.
 */

// 환율과 API 마진은 기본값으로 설정 (또는 환경변수에서 읽기)
const usd_to_krw = parseInt(process.env.USD_TO_KRW || '1500')
const api_margin = parseFloat(process.env.API_MARGIN || '1.2')


class AIServiceBase {
  constructor(provider_name) {
    // 이 클래스가 직접 인스턴스화되는 것을 방지합니다
    this.provider_name = provider_name
    if (this.constructor === AIServiceBase) {
      throw new Error('AIServiceBase 클래스는 추상 클래스로, 직접 인스턴스화할 수 없습니다.')
    }

    this.usd_to_krw = usd_to_krw
    this.api_margin = api_margin
    debug('usd_to_krw', usd_to_krw)
    debug('api_margin', api_margin)

    this.supports = {
      text: false,    // 텍스트 생성 지원 여부
      image: false,   // 이미지 생성 지원 여부
      audio: false,   // 오디오 생성/변환 지원 여부
      video: false    // 비디오 생성 지원 여부
    }

    this.models_info = []
  }


  /**
   * 특정 기능 지원 여부 확인
   * @param {string} feature - 확인할 기능 ('text', 'image', 'audio', 'video')
   * @returns {boolean} 지원 여부
   */
  supportsFeature(feature) {
    return this.supports[feature] || false
  }

  /**
   * 지원하는 모든 기능 목록 반환
   * @returns {Object} 지원하는 기능 목록 객체
   */
  getSupportedFeatures() {
    return { ...this.supports }
  }

  /**
   * 텍스트 생성 메서드 (구현 필요)
   * @param {string} prompt - 프롬프트 텍스트
   * @param {Object} options - 추가 옵션
   * @returns {Promise<Object>} 응답 객체
   */
  async generateText({
    prompt,
    model = this.default_text_model,
    temperature = 0.7,
    max_tokens = 500,
    ai_rule,
    tools,

  }) {
    throw new Error('generateText 메서드가 구현되지 않았습니다.')
  }

  async generateImage({
    prompt,
    model = this.default_image_model,
    width = 1024,
    height = 1024,
    n = 1,
    calculate_cost = false
  }) {
    throw new Error('generateImage 메서드가 구현되지 않았습니다.')
  }

  async editImage({
    prompt,
    model = this.default_image_model,
    n = 1,
    calculate_cost = false
  }) {
    throw new Error('editImage 메서드가 구현되지 않았습니다.')
  }

  async generateTTS(input, options = {}) {
    throw new Error('generateTTS 메서드가 구현되지 않았습니다.')
  }

  /**
   * 비디오 생성 메서드 (구현 필요)
   * @param {string|Object} input - 프롬프트 텍스트 또는 입력 데이터
   * @param {Object} options - 추가 옵션
   * @returns {Promise<Object>} 응답 객체
   */
  async generateVideo(input, options = {}) {
    throw new Error('generateVideo 메서드가 구현되지 않았습니다.')
  }

  calculateCost({ model, input_tokens, output_tokens }) {
    let model_info = this.models_info.find(model_info => model_info.model === model)

    if (model_info == null ||
      model_info.input_token_price == null ||
      model_info.output_token_price == null
    ) {
      debug('모델을 찾을 수 없음:', model)
      return {
        points: 0,
        input_cost: 0,
        output_cost: 0,
        total_cost_usd: 0,
        total_cost_krw: 0,
        provider: null,
        model: model
      }
    }

    const input_cost = model_info.input_token_price * input_tokens
    const output_cost = model_info.output_token_price * output_tokens
    const total_cost_usd = input_cost + output_cost
    const total_cost_krw = total_cost_usd * usd_to_krw
    debug('input_cost', input_cost)
    debug('output_cost', output_cost)
    debug('total_cost_usd', total_cost_usd)
    debug('total_cost_krw', total_cost_krw)

    return {
      input_cost,
      output_cost,
      total_cost_usd,
      total_cost_krw,
    }
  }

  async test({ feature = null, tools = [] }) {
    const test_dir = `test_output/${this.provider_name}`
    if (this.provider_name == null) {
      debug('typeof', typeof this)
    }
    try {
      await fs.access(test_dir)
    } catch (error) {
      await fs.mkdir(test_dir, { recursive: true })
    }
    for (const model_info of this.models_info) {
      const result = await this.testModel({ model_info, test_dir, feature, tools: tools })
      try {
        debug(`모델 ${model_info.model} 테스트 성공:`)
      } catch (error) {
        console.error(`모델 ${model.model} 테스트 실패:`, error.message)
      }
    }
  }

  /**
   * 특정 모델을 테스트하는 함수
   * @param {Object} params - 테스트 파라미터 객체
   * @param {Object} params.model_info - 모델 정보 객체
   * @param {string} params.test_dir - 테스트 결과를 저장할 디렉토리
   * @param {string|null} params.feature - 테스트할 기능 ('text', 'image', 'audio', 'video', null)
   *                                       null인 경우 모든 지원 기능을 테스트
   */
  async testModel({ model_info, test_dir, feature = null, tools = [] }) {
    debug('testModel', model_info, 'feature:', feature)
    if (model_info == null) {
      throw new Error(`모델 ${model_info.model}을 찾을 수 없습니다.`)
    }
    const model = model_info.model

    // feature가 지정된 경우, 해당 feature만 테스트
    // feature가 null인 경우, 모든 지원 기능을 테스트
    const shouldTestText = feature === null || feature === 'text'
    const shouldTestImage = feature === null || feature === 'image'
    const shouldTestAudio = feature === null || feature === 'audio'
    const shouldTestVideo = feature === null || feature === 'video'

    if (shouldTestText && model_info.support_text_output) {
      let prompt = '30초짜리 영상 쇼츠 제작에 사용할 나레이션 대사를 한글로 작성해주세요. 한줄에 한문장씩 작성해주세요. 덧붙이는 대사는 만들지 않는다.'
      if (tools.includes('web_search')) {
        prompt = '오늘의 한국 뉴스중에서 쇼츠로 구성할만 한것을 찾아서 30초짜리 영상 쇼츠 제작에 사용할 나레이션 대사를 한글로 작성해주세요. 한줄에 한문장씩 작성해주세요. 덧붙이는 대사는 만들지 않는다.'
      }
      const {
        text,
        usage,
        cost
      } = await this.generateText({
        prompt,
        model: model,
        tools: tools,
      })
      debug('text', text)
      const usage_str = usage != null ? JSON.stringify(usage, null, 2) : null
      const cost_str = cost != null ? JSON.stringify(cost, null, 2) : null
      await fs.writeFile(`${test_dir}/${model}.txt`, `${text}\n\n${usage_str}\n\n${cost_str}`)
    }
    if (shouldTestImage && model_info.support_image_output) {
      const {
        image,
        usage,
        cost
      } = await this.generateImage({
        prompt: '발아시킨 후 볶아 만든 보리차\n구수한 맛과 향이 살아있는 건강한 보리차\n지퍼팩 포장으로 개봉 후 위생적으로 관리',
        model: model,
      })
      const usage_str = usage != null ? JSON.stringify(usage, null, 2) : null
      const cost_str = cost != null ? JSON.stringify(cost, null, 2) : null
      await fs.writeFile(`${test_dir}/${model}.jpg`, image)
      debug(`${model} 테스트 결과 저장:`, { usage, cost })
    }
    if (shouldTestAudio && model_info.support_tts_output) {
      const {
        audio,
        usage,
        cost
      } = await this.generateTTS({
        prompt: '발아시킨 후 볶아 만든 보리차\n구수한 맛과 향이 살아있는 건강한 보리차\n지퍼팩 포장으로 개봉 후 위생적으로 관리',
        model: model,
      })
      const usage_str = usage != null ? JSON.stringify(usage, null, 2) : null
      const cost_str = cost != null ? JSON.stringify(cost, null, 2) : null
      await fs.writeFile(`${test_dir}/${model}.mp3`, audio)
      debug(`${model} 테스트 결과 저장:`, { usage, cost })
    }
    if (shouldTestVideo && model_info.support_video_output) {
      const {
        video,
        usage,
        cost
      } = await this.generateVideo({
        prompt: '발아시킨 후 볶아 만든 보리차\n구수한 맛과 향이 살아있는 건강한 보리차\n지퍼팩 포장으로 개봉 후 위생적으로 관리',
        model: model,
      })
      const usage_str = usage != null ? JSON.stringify(usage, null, 2) : null
      const cost_str = cost != null ? JSON.stringify(cost, null, 2) : null
      await fs.writeFile(`${test_dir}/${model}.mp4`, video)
      debug(`${model} 테스트 결과 저장:`, { usage, cost })
    }
    debug(`${model} 테스트 완료`)
  }
}

export default AIServiceBase