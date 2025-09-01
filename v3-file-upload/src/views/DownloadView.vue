<template>
  <div class="download-container">
    <h1>文件下载</h1>
    <div class="file-list">
      <el-table v-loading="loading" :data="fileList" style="width: 100%">
        <el-table-column prop="filename" label="文件名" />
        <el-table-column prop="size" label="文件大小" />
        <el-table-column prop="createdAt" label="创建时间">
          <template #default="scope">
            {{ formatDate(scope.row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作">
          <template #default="scope">
            <div class="operation-column">
              <template v-if="!downloadingStates[scope.row.filename]">
                <el-button type="primary" @click="startDownload(scope.row.filename)">
                  下载
                </el-button>
              </template>
              <template v-else>
                <el-button 
                  v-if="!downloadingStates[scope.row.filename].paused"
                  type="warning" 
                  @click="pauseDownload(scope.row.filename)"
                >
                  暂停
                </el-button>
                <el-button 
                  v-else
                  type="success" 
                  @click="resumeDownload(scope.row.filename)"
                >
                  继续
                </el-button>
                <el-button 
                  type="danger" 
                  @click="stopDownload(scope.row.filename)"
                >
                  停止
                </el-button>
              </template>
              <el-progress 
                v-if="downloadingStates[scope.row.filename]"
                :percentage="downloadProgress[scope.row.filename] || 0"
                :stroke-width="15"
                :show-text="false"
                style="width: 100px; margin-left: 10px;"
              />
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';

export default {
  name: 'DownloadView',
  setup() {
    const fileList = ref([]);
    const loading = ref(false);
    const downloading = ref('');
    const downloadProgress = ref({});
    const downloadingStates = ref({}); // 存储下载状态
    const downloadControllers = ref({}); // 存储下载控制器

    const fetchWithRetry = async (url, options = {}, retries = 3) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...options.headers
          }
        });

        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        if (retries > 0) {
          console.log(`请求失败，剩余重试次数: ${retries - 1}`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
          return fetchWithRetry(url, options, retries - 1);
        }
        throw error;
      }
    };

    const fetchFileList = async () => {
      loading.value = true;
      try {
        console.log('开始获取文件列表...');
        const response = await fetch('http://localhost:3030/download/list', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        console.log('响应状态:', response.status);
        const result = await response.json();
        console.log('响应数据:', result);
        
        if (result.code !== 200) {
          throw new Error(result.message || '获取文件列表失败');
        }
        
        if (!Array.isArray(result.data)) {
          throw new Error('返回的数据格式不正确');
        }
        
        fileList.value = (result.data).map(item=>{
          return {
            filename: item,
            size: 0,
            createdAt: new Date()
          }
        });
        console.log('文件列表更新成功:', fileList.value);
      } catch (error) {
        console.error('获取文件列表失败:', error);
        ElMessage.error(error.message || '获取文件列表失败');
        fileList.value = []; // 清空列表
      } finally {
        loading.value = false;
      }
    };

    const startDownload = async (filename) => {
      if (downloadingStates.value[filename]) {
        return;
      }

      downloadingStates.value[filename] = {
        paused: false,
        receivedLength: 0,
        totalSize: 0
      };

      downloadControllers.value[filename] = new AbortController();
      await downloadFile(filename);
    };

    const pauseDownload = (filename) => {
      if (downloadingStates.value[filename]) {
        downloadingStates.value[filename].paused = true;
        downloadControllers.value[filename].abort();
      }
    };

    const resumeDownload = async (filename) => {
      if (downloadingStates.value[filename] && downloadingStates.value[filename].paused) {
        downloadingStates.value[filename].paused = false;
        downloadControllers.value[filename] = new AbortController();
        await downloadFile(filename);
      }
    };

    const stopDownload = (filename) => {
      if (downloadingStates.value[filename]) {
        // 强制终止下载控制器
        downloadControllers.value[filename].abort();
        
        // 清理所有状态
        delete downloadingStates.value[filename];
        delete downloadControllers.value[filename];
        downloadProgress.value[filename] = 0;
        
        // 重置下载状态
        downloading.value = '';
        
        // 显示停止消息
        ElMessage.info('下载已停止');
      }
    };

    const downloadFile = async (filename) => {
      downloading.value = filename;
      const state = downloadingStates.value[filename];
      
      try {
        console.log('开始下载文件:', filename);
        
        const response = await fetchWithRetry(`http://localhost:3030/download/${filename}`, {
          headers: {
            'Accept': 'application/octet-stream',
            'Range': `bytes=${state.receivedLength}-`
          },
          signal: downloadControllers.value[filename].signal
        });

        // 检查是否被停止
        if (!downloadingStates.value[filename]) {
          console.log('下载已被停止');
          return;
        }

        console.log('下载响应状态:', response.status);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || '下载失败');
        }

        // 获取文件大小
        const contentLength = response.headers.get('Content-Length');
        const totalSize = parseInt(contentLength, 10) + state.receivedLength;
        state.totalSize = totalSize;
        
        // 创建可读流
        const reader = response.body.getReader();
        const chunks = [];
        let receivedLength = state.receivedLength;

        while(true) {
          // 检查是否被停止
          if (!downloadingStates.value[filename]) {
            console.log('下载已被停止');
            return;
          }

          if (state.paused) {
            break;
          }

          const {done, value} = await reader.read();
          
          if (done) {
            break;
          }
          
          chunks.push(value);
          receivedLength += value.length;
          state.receivedLength = receivedLength;
          
          // 更新下载进度
          const progress = Math.round((receivedLength / totalSize) * 100);
          downloadProgress.value[filename] = progress;
          console.log(`已下载: ${receivedLength} / ${totalSize}`);
        }

        if (!state.paused && downloadingStates.value[filename]) {
          // 合并所有 chunks
          const blob = new Blob(chunks);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          ElMessage.success('下载成功');
          
          // 清理状态
          delete downloadingStates.value[filename];
          delete downloadControllers.value[filename];
          downloadProgress.value[filename] = 0;
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('下载已暂停或停止');
        } else {
          console.error('下载失败:', error);
          ElMessage.error(error.message || '下载失败，请重试');
          
          // 清理状态
          delete downloadingStates.value[filename];
          delete downloadControllers.value[filename];
          downloadProgress.value[filename] = 0;
        }
      } finally {
        downloading.value = '';
      }
    };

    const formatDate = (date) => {
      if (!date) return '';
      return new Date(date).toLocaleString();
    };

    onMounted(() => {
      console.log('组件挂载，开始获取文件列表');
      fetchFileList();
    });

    return {
      fileList,
      loading,
      downloading,
      downloadProgress,
      downloadingStates,
      startDownload,
      pauseDownload,
      resumeDownload,
      stopDownload,
      formatDate
    };
  }
};
</script>

<style scoped>
.download-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

h1 {
  margin-bottom: 20px;
  color: #333;
}

.file-list {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.operation-column {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style> 