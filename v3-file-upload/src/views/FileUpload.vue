<template>
  <div class="file-upload">
    <h2>大文件上传</h2>
    
    <div class="upload-container">
      <el-upload
        class="upload-drop"
        drag
        action="#"
        :auto-upload="false"
        :show-file-list="false"
        :on-change="handleFileChange"
      >
        <i class="el-icon-upload"></i>
        <div class="el-upload__text">
          将文件拖到此处，或<em>点击上传</em>
        </div>
      </el-upload>

      <div v-if="currentFile" class="file-info">
        <h3>文件信息</h3>
        <p>文件名：{{ currentFile.name }}</p>
        <p>大小：{{ formatFileSize(currentFile.size) }}</p>
        <p>类型：{{ currentFile.type || '未知' }}</p>
        
        <el-progress 
          :percentage="uploadProgress" 
          :status="uploadStatus"
        ></el-progress>

        <div class="upload-actions">
          <el-button 
            type="primary" 
            @click="handleUpload" 
            :loading="uploading"
            :disabled="!currentFile || uploading"
          >
            开始上传
          </el-button>
          <el-button 
            @click="cancelUpload" 
            :disabled="!uploading"
          >
            取消上传
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import SparkMD5 from 'spark-md5'

const currentFile = ref(null)
const uploadProgress = ref(0)
const uploadStatus = ref('')
const uploading = ref(false)
const chunkSize = 2 * 1024 * 1024 // 2MB 切片大小

// 格式化文件大小
const formatFileSize = (size) => {
  if (!size) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index++
  }
  return `${size.toFixed(2)} ${units[index]}`
}

// 处理文件选择
const handleFileChange = (file) => {
  currentFile.value = file.raw
  uploadProgress.value = 0
  uploadStatus.value = ''
}

// 计算文件hash
const calculateHash = (file) => {
  return new Promise((resolve) => {
    const spark = new SparkMD5.ArrayBuffer()
    const reader = new FileReader()
    reader.readAsArrayBuffer(file)
    reader.onload = (e) => {
      spark.append(e.target.result)
      resolve(spark.end())
    }
  })
}

// 创建切片
const createFileChunks = (file, size = chunkSize) => {
  const chunks = []
  let cur = 0
  while (cur < file.size) {
    chunks.push({ file: file.slice(cur, cur + size) })
    cur += size
  }
  return chunks
}

// 上传切片
const uploadChunks = async (chunks, fileHash, fileName) => {
  const requests = chunks.map((chunk, index) => {
    const formData = new FormData()
    formData.append('chunkFile', chunk.file)
    formData.append('fileHash', fileHash)
    formData.append('chunkHash', `${fileHash}-${index}`)
    formData.append('fileName', fileName)
    
    return fetch('http://localhost:3030/upload', {
      method: 'POST',
      body: formData
    }).then(res => res.json())
  })

  let completedChunks = 0
  await Promise.all(
    requests.map(promise => 
      promise.then(() => {
        completedChunks++
        uploadProgress.value = Math.floor((completedChunks / chunks.length) * 90)
      })
    )
  )
}

// 合并切片
const mergeRequest = async (fileHash, fileName) => {
  uploadProgress.value = 90
  await fetch('http://localhost:3030/merge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileHash,
      fileName,
      chunkSize
    })
  })
  uploadProgress.value = 100
}

// 处理上传
const handleUpload = async () => {
  if (!currentFile.value) return
  
  try {
    uploading.value = true
    uploadStatus.value = ''
    
    // 1. 计算文件hash
    const fileHash = await calculateHash(currentFile.value)
    
    // 2. 验证文件是否已存在
    const verifyRes = await fetch('http://localhost:3030/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileHash,
        fileName: currentFile.value.name
      })
    }).then(res => res.json())

    if (!verifyRes.data.shouldUpload) {
      ElMessage.success('文件已存在')
      uploadProgress.value = 100
      uploadStatus.value = 'success'
      return
    }

    // 3. 切片上传
    const chunks = createFileChunks(currentFile.value)
    await uploadChunks(chunks, fileHash, currentFile.value.name)
    
    // 4. 合并切片
    await mergeRequest(fileHash, currentFile.value.name)
    
    uploadProgress.value = 100
    uploadStatus.value = 'success'
    ElMessage.success('上传成功')
  } catch (error) {
    uploadStatus.value = 'exception'
    ElMessage.error('上传失败')
  } finally {
    uploading.value = false
  }
}

// 取消上传
const cancelUpload = () => {
  uploading.value = false
  uploadProgress.value = 0
  uploadStatus.value = ''
  currentFile.value = null
}
</script>

<style scoped>
.file-upload {
  padding: 20px;
}

.upload-container {
  max-width: 800px;
  margin: 20px auto;
}

.upload-drop {
  border: 2px dashed #dcdfe6;
  border-radius: 6px;
  padding: 20px;
  text-align: center;
}

.file-info {
  margin-top: 20px;
  padding: 20px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.upload-actions {
  margin-top: 20px;
  display: flex;
  gap: 10px;
}
</style> 