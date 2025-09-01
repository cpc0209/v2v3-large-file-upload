<template>
  <div class="home-container">
    <h1>文件上传示例</h1>
    
    <div class="card-container">
      <div class="card" @click="navigateTo('file-upload')">
        <h2>大文件上传</h2>
        <p>支持大文件分片上传，断点续传</p>
      </div>
      
      <div class="card" @click="navigateTo('file-manager')">
        <h2>文件管理器</h2>
        <p>文件的上传、下载、删除等管理功能</p>
      </div>
      
      <div class="card" @click="navigateTo('multiple-upload')">
        <h2>多文件上传</h2>
        <p>支持多文件同时上传，带进度显示</p>
      </div>

      <div class="card" @click="navigateTo('download')">
        <h2>文件下载</h2>
        <p>支持文件下载，断点续传</p>
      </div>

      <div class="card" @click="navigateTo('upload-image')">
        <h2>图片批量上传</h2>
        <p>支持拖拽上传，图片预览，批量处理</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const navigateTo = (path) => {
  router.push(`/${path}`)
}
</script>

<style scoped>
.home-container {
  padding: 40px;
  text-align: center;
}

.home-container h1 {
  margin-bottom: 40px;
  color: #303133;
}

.card-container {
  display: flex;
  justify-content: center;
  gap: 30px;
  flex-wrap: wrap;
}

.card {
  width: 280px;
  padding: 24px;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.3s;
}

.card:hover {
  transform: translateY(-5px);
  box-shadow: 0 4px 16px 0 rgba(0, 0, 0, 0.15);
}

.card h2 {
  margin-bottom: 16px;
  color: #303133;
}

.card p {
  color: #606266;
  font-size: 14px;
}
</style>
