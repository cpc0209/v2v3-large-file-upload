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
 * @returns 返回值描述（如果有的话）
 */

// 上传单个切片
export function uploadFile(data) {
  // 封装 axios 请求或 HTTP 客户端请求
  return service({
    url: '/upload',
    method: 'post',
    data,
  })
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
