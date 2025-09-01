<template>
  <div class="folder-upload">
    <div class="upload-container" ref="uploadRef">
      <!-- 上传按钮 -->
      <input
        type="file"
        ref="folderInput"
        @change="handleFolderSelect"
        style="display: none"
        webkitdirectory
        directory
      />
      
      <el-button 
        type="primary" 
        @click="triggerFolderSelect"
        :loading="uploading"
      >
        {{ uploading ? '上传中...' : '选择文件夹' }}
      </el-button>

      <!-- 拖拽区域 -->
      <div 
        class="drop-zone"
        :class="{ 'is-dragover': isDragover }"
        @dragover.prevent="handleDragover"
        @dragleave.prevent="handleDragleave"
        @drop.prevent="handleDrop"
      >
        <p>将文件夹拖到此处，或点击上方按钮选择文件夹</p>
      </div>

      <!-- 上传进度 -->
      <div v-if="uploadProgress.isUploading" class="upload-progress">
        <el-progress 
          :percentage="uploadProgress.percentage" 
          :status="uploadProgress.percentage === 100 ? 'success' : ''"
        />
        <p class="upload-info">
          正在上传: {{ uploadProgress.currentFile }}
          ({{ uploadProgress.currentIndex }}/{{ uploadProgress.totalFiles }})
        </p>
      </div>

      <!-- 文件夹结构树 -->
      <div v-if="folderStructure" class="folder-structure">
        <h3>文件夹结构：</h3>
        <el-tree
          :data="transformStructureToTreeData(folderStructure)"
          :props="{
            label: 'name',
            children: 'children'
          }"
          node-key="path"
          default-expand-all
        >
          <template #default="{ node, data }">
            <span class="custom-tree-node">
              <el-icon v-if="data.type === 'directory'"><Folder /></el-icon>
              <el-icon v-else><Document /></el-icon>
              <span>{{ node.label }}</span>
              <span v-if="data.type === 'file'" class="file-size">
                {{ formatFileSize(data.size) }}
              </span>
            </span>
          </template>
        </el-tree>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { Folder, Document } from '@element-plus/icons-vue'
import { uploadFolder } from '@/api'

const folderInput = ref(null)
const uploading = ref(false)
const isDragover = ref(false)
const folderStructure = ref(null)

const uploadProgress = reactive({
  isUploading: false,
  percentage: 0,
  currentFile: '',
  currentIndex: 0,
  totalFiles: 0
})

// 触发文件夹选择
const triggerFolderSelect = () => {
  folderInput.value.click()
}

// 处理文件夹选择
const handleFolderSelect = async (event) => {
  const files = event.target.files
  if (!files.length) {
    ElMessage.warning('未选择任何文件')
    return
  }

  // 获取根文件夹名称和所有文件的相对路径
  const folderName = files[0].webkitRelativePath.split('/')[0]
  const fileList = Array.from(files).map(file => ({
    file,
    // webkitRelativePath 格式为：folder/subfolder/file.txt
    relativePath: file.webkitRelativePath,
    fullPath: file.webkitRelativePath
  }))

  await uploadFiles(fileList, folderName)
}

// 处理拖拽
const handleDragover = (e) => {
  isDragover.value = true
}

const handleDragleave = (e) => {
  isDragover.value = false
}

const handleDrop = async (e) => {
  e.preventDefault()
  isDragover.value = false
  const items = e.dataTransfer.items

  if (items && items.length > 0) {
    const entry = items[0].webkitGetAsEntry()
    if (entry.isDirectory) {
      const folderName = entry.name
      const fileList = []
      await traverseDirectory(entry, fileList)
      if (fileList.length > 0) {
        await uploadFiles(fileList, folderName)
      }
    }
  }
}

// 遍历目录
const traverseDirectory = async (entry, fileList, path = '') => {
  if (entry.isFile) {
    const file = await new Promise((resolve) => {
      entry.file(resolve)
    })
    // 构建相对路径
    const relativePath = path ? `${path}/${entry.name}` : entry.name
    fileList.push({
      file,
      relativePath,
      fullPath: relativePath
    })
  } else if (entry.isDirectory) {
    const dirReader = entry.createReader()
    const entries = await new Promise((resolve) => {
      dirReader.readEntries(resolve)
    })
    const newPath = path ? `${path}/${entry.name}` : entry.name
    for (const childEntry of entries) {
      await traverseDirectory(childEntry, fileList, newPath)
    }
  }
}

// 上传文件
const uploadFiles = async (fileList, folderName) => {
  try {
    uploading.value = true
    uploadProgress.isUploading = true
    uploadProgress.totalFiles = fileList.length

    const formData = new FormData()
    formData.append('folderName', folderName)

    // 添加所有文件及其路径信息
    fileList.forEach(({ file, relativePath }, index) => {
      formData.append(`files`, file)
      formData.append(`paths[${index}]`, relativePath)
    })

    const response = await uploadFolder(formData, (progressEvent) => {
      if (progressEvent.lengthComputable) {
        // 计算总体上传进度
        const percentComplete = Math.round((progressEvent.loaded / progressEvent.total) * 100)
        uploadProgress.percentage = percentComplete
        
        // 估算当前正在上传的文件
        const fileIndex = Math.floor((fileList.length * progressEvent.loaded) / progressEvent.total)
        if (fileIndex < fileList.length) {
          uploadProgress.currentIndex = fileIndex + 1
          uploadProgress.currentFile = fileList[fileIndex].relativePath
        }
      }
    })

    if (response.data.success) {
      ElMessage.success('文件夹上传成功')
      folderStructure.value = response.data.structure
    } else {
      throw new Error(response.data.message || '上传失败')
    }
  } catch (error) {
    ElMessage.error(`上传失败: ${error.message}`)
  } finally {
    uploading.value = false
    uploadProgress.isUploading = false
    if (folderInput.value) {
      folderInput.value.value = ''
    }
  }
}

// 转换目录结构为树形数据
const transformStructureToTreeData = (structure) => {
  return Object.entries(structure).map(([key, value]) => {
    if (value.type === 'directory') {
      return {
        name: key,
        type: 'directory',
        children: transformStructureToTreeData(value.children)
      }
    } else {
      return {
        name: key,
        type: 'file',
        size: value.size,
        path: value.path
      }
    }
  })
}

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<style scoped>
.folder-upload {
  padding: 20px;
}

.upload-container {
  max-width: 800px;
  margin: 0 auto;
}

.drop-zone {
  margin-top: 20px;
  padding: 40px;
  border: 2px dashed #dcdfe6;
  border-radius: 4px;
  text-align: center;
  color: #606266;
  transition: all 0.3s;
}

.drop-zone.is-dragover {
  border-color: #409eff;
  background-color: rgba(64, 158, 255, 0.06);
}

.upload-progress {
  margin-top: 20px;
  padding: 15px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.upload-info {
  margin-top: 10px;
  font-size: 14px;
  color: #606266;
}

.folder-structure {
  margin-top: 20px;
  padding: 20px;
  background-color: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.custom-tree-node {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-size {
  color: #909399;
  font-size: 12px;
  margin-left: 8px;
}
</style>