import axios, { type AxiosRequestConfig } from 'axios'
import { config } from '../lib/config'

// 모든 API 호출이 공유하는 axios 인스턴스.
// baseURL은 런타임 config에서 오며 기본값은 '/api'(동일 오리진).
export const axiosInstance = axios.create({
  baseURL: config.API_BASE_URL,
})

// orval이 생성하는 훅들이 사용하는 mutator.
// (orval.config.ts의 override.mutator 에서 이 함수를 참조한다.)
export const customInstance = <T>(cfg: AxiosRequestConfig): Promise<T> => {
  return axiosInstance({ ...cfg }).then((res) => res.data)
}

export default customInstance
