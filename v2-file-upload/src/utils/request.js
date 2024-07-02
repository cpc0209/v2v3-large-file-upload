import axios from 'axios'

// 设置请求头
const myBaseURL = 'http://localhost:3000'

// 创建axios实例
const service = axios.create({
  baseURL: myBaseURL, // 请求头
  timeout: 6 * 1000, // 请求超时时间
})

// 响应拦截
service.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    return Promise.reject(error)
  }
)

export default service
