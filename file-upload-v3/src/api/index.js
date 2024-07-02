import service from '@/utils/request'

/**
 * [uploadFile] - 上传切片参数
 * @param fileHash 文件hash，String
 * @param fileSize 文件大小，Number
 * @param fileName 文件名称，String
 * @param index 多文件上传中的所在index，number
 * @param chunkFile 切片文件本身，File || Blob || void
 * @param chunkHash 切片文件hash，String
 * @param chunkSize 分片大小，Number
 * @param chunkNumber 切片总数量，Number
 * @param finish 是否上传完成，可选参数，Boolean
 */

// 上传单个切片
export function uploadFile(data, onCancel) {
  const controller = new AbortController()
  const signal = controller.signal // 获取 signal 对象
  // 封装 axios 请求或 HTTP 客户端请求
  const request = service({
    url: '/upload',
    method: 'post',
    data,
    signal, // 将 signal 传递给服务函数
  })
  // 如果提供了 onCancel 回调，则传递取消函数
  if (typeof onCancel === 'function') {
    // 如果是一个函数，则直接调用传一个取消方法给 这个方法
    // 所以只要传进来是方法，就会直接传一个参数并直接触发这个函数
    // 那传过来的这个方法就会接收到一个参数（就是取消函数() => controller.abort()）
    // 在调用uploadFile就可以拿到这个参数
    onCancel(() => controller.abort()) // 调用 onCancel 时传入取消函数
  }
  return request
}

/**
 * [mergeChunk] - 合并切片
 * @param chunkSize 分片大小，Number
 * @param fileName 文件名称，String
 * @param fileSize 文件大小，Number
 */

// 合并所有切片
export function mergeChunk(data) {
  return service({
    url: '/merge',
    method: 'post',
    data,
  })
}

/**
 * [checkFile] - 检查文件是否存在
 * @param fileHash 文件hash，String
 * @param fileName 文件名称，String
 */

// 检查文件是否存在
export function checkFile(data) {
  return service({
    url: '/verify',
    method: 'post',
    data,
  })
}

