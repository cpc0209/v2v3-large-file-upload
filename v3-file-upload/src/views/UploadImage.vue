<template>
  <div class="upload-container">
    <h2>图片批量上传</h2>
    <div class="upload-area" @click="triggerFileInput" @dragover.prevent @drop.prevent="handleDrop">
      <input
        type="file"
        ref="fileInput"
        multiple
        accept="image/*"
        @change="handleFileChange"
        style="display: none"
      />
      <div class="upload-content">
        <i class="upload-icon">📁</i>
        <p>点击或拖拽图片到此处上传</p>
        <p class="upload-hint">支持 JPG、PNG、GIF 格式，单文件最大 5MB</p>
      </div>
    </div>

    <div v-if="files.length > 0" class="file-list">
      <div v-for="(file, index) in files" :key="index" class="file-item">
        <div class="file-info">
          <img :src="file.preview" class="preview-image" />
          <div class="file-details">
            <p class="file-name">{{ file.name }}</p>
            <p class="file-size">{{ formatFileSize(file.size) }}</p>
          </div>
        </div>
        <div class="file-actions">
          <button @click="removeFile(index)" class="remove-btn">删除</button>
        </div>
      </div>
    </div>

    <div class="upload-progress" v-if="uploading">
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: `${uploadProgress}%` }"
        ></div>
      </div>
      <p class="progress-text">{{ uploadProgress }}%</p>
    </div>

    <div class="upload-actions">
      <button
        @click="uploadFiles"
        :disabled="files.length === 0 || uploading"
        class="upload-btn"
      >
        {{ uploading ? '上传中...' : '开始上传' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import axios from 'axios';

const fileInput = ref(null);
const files = ref([]);
const uploading = ref(false);
const uploadProgress = ref(0);

const triggerFileInput = () => {
  fileInput.value.click();
};

const handleFileChange = (event) => {
  const selectedFiles = Array.from(event.target.files);
  processFiles(selectedFiles);
};

const handleDrop = (event) => {
  const droppedFiles = Array.from(event.dataTransfer.files);
  processFiles(droppedFiles);
};

const processFiles = (fileList) => {
  fileList.forEach((file) => {
    if (file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = (e) => {
        files.value.push({
          file,
          name: file.name,
          size: file.size,
          preview: e.target.result,
        });
      };
      reader.readAsDataURL(file);
    } else {
      alert('请上传有效的图片文件（最大 5MB）');
    }
  });
};

const removeFile = (index) => {
  files.value.splice(index, 1);
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const uploadFiles = async () => {
  if (files.value.length === 0) {
    alert('请选择要上传的图片');
    return;
  }

  uploading.value = true;
  uploadProgress.value = 0;

  const formData = new FormData();
  files.value.forEach((file) => {
    formData.append('images', file.file);
  });

  try {
    const response = await axios.post('http://localhost:3030/upload-images/batch', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        uploadProgress.value = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
      },
    });

    if (response.data.success) {
      alert('上传成功！');
      files.value = [];
    } else {
      throw new Error(response.data.message || '上传失败');
    }
  } catch (error) {
    if (error.response) {
      // 服务器返回的错误
      alert(`上传失败：${error.response.data.message || error.response.data}`);
    } else if (error.request) {
      // 请求已发送但没有收到响应
      alert('服务器无响应，请检查网络连接');
    } else {
      // 请求配置出错
      alert(`上传失败：${error.message}`);
    }
  } finally {
    uploading.value = false;
    uploadProgress.value = 0;
  }
};
</script>

<style scoped>
.upload-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.upload-area {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  margin-bottom: 20px;
}

.upload-area:hover {
  border-color: #409eff;
  background-color: #f5f7fa;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.upload-icon {
  font-size: 48px;
}

.upload-hint {
  color: #909399;
  font-size: 14px;
}

.file-list {
  margin-top: 20px;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  margin-bottom: 10px;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.preview-image {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
}

.file-details {
  display: flex;
  flex-direction: column;
}

.file-name {
  margin: 0;
  font-size: 14px;
}

.file-size {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

.remove-btn {
  color: #f56c6c;
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px 10px;
}

.remove-btn:hover {
  background-color: #fef0f0;
}

.upload-progress {
  margin: 20px 0;
}

.progress-bar {
  height: 6px;
  background-color: #ebeef5;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #409eff;
  transition: width 0.3s;
}

.progress-text {
  text-align: center;
  margin-top: 5px;
  font-size: 14px;
  color: #606266;
}

.upload-btn {
  background-color: #409eff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s;
}

.upload-btn:hover {
  background-color: #66b1ff;
}

.upload-btn:disabled {
  background-color: #a0cfff;
  cursor: not-allowed;
}
</style>
