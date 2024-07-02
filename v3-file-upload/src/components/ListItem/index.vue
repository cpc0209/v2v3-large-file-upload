<template>
  <div v-for="item in props.uploadFileList" :key="item.id">
    <div class="list_item">
      <div class="left_box">
        <p class="left_box_fileName">
          {{ item.fileName }}
        </p>
        <!-- 单个文件进度条 -->
        <div class="left_box_percentage">
          <div class="percentage_bac">
            <div
              class="percentage_box"
              :style="{ width: `${item.percentage}%` }"></div>
            <div class="percentage_box_span">
              <span>{{ Math.floor(item.percentage) }}%</span>
            </div>
          </div>
          <div class="bottom_hint">
            <div>
              <p>{{ fileSize(item.fileSize) }}</p>
            </div>
            <div style="margin-left: 4px">
              <div
                v-if="item.state === 0"
                style="height: 24px; width: 100%"></div>
              <p v-else-if="item.state === 1">正在解析中...</p>
              <p v-else-if="item.state === 2">正在上传中...</p>
              <p v-else-if="item.state === 3">暂停中</p>
              <p v-else-if="item.state === 4">上传完成</p>
              <p v-else-if="item.state === 5">上传中断</p>
              <p v-else-if="item.state === 6">上传失败</p>
            </div>
          </div>
        </div>
      </div>
      <!-- 右侧按钮 -->
      <div class="rightBtn">
        <!-- 必须解析完才能暂停，不然是没有接口取消调用的 -->
        <div
          class="my_btn redBtn"
          @click="pauseUpload(item)"
          v-if="[2].includes(item.state)">
          暂停
        </div>
        <!-- 暂停中显示的继续按钮 -->
        <div
          class="my_btn blueBtn"
          @click="resumeUpload(item)"
          v-if="[3, 5].includes(item.state)">
          继续
        </div>
        <div class="my_btn redBtn" @click="cancelSingle(item)">取消</div>
      </div>
    </div>
  </div>
  <div style="height: 108px"></div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'
// 显示到视图层的初始数据:
const props = defineProps({
  uploadFileList: { type: Array, default: [] },
})
const emit = defineEmits(['pauseUpload', 'resumeUpload', 'cancelSingle'])
// 暂停
const pauseUpload = (item) => {
  emit('pauseUpload', item)
}
// 继续上传
const resumeUpload = (item) => {
  emit('resumeUpload', item)
}
// 取消
const cancelSingle = (item) => {
  emit('cancelSingle', item)
}
// 显示文件大小
const fileSize = (val) => {
  const m = 1024 * 1024
  if (val > m) {
    const num = Math.ceil(val / m)
    const numB = Math.ceil(num / 1024)
    if (numB > 1) {
      return `${numB}G`
    } else {
      return `${num}M`
    }
  } else {
    const numC = Math.ceil(val / 1024)
    return `${numC}KB`
  }
}
</script>

<style scoped>
.list_item {
  margin: 0 10px 20px 10px;
  display: flex;
  transition: all 1s;
}
.percentage_bac {
  height: 20px;
  width: 100%;
  border-radius: 8px;
  background-color: #1b1f24;
  margin: 10px 0;
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.5) inset;
  position: relative;
  overflow: hidden;
}
.percentage_box {
  height: 100%;
  transition: all 0.1s;
  background-color: #73c944;
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
}
.percentage_box_span {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  display: flex;
  justify-content: center;
  font-size: 14px;
  color: #e1eae2;
  height: 20px;
  line-height: 20px;
}
.left_box {
  flex: 1;
  margin: 10px 0;
  font-size: 14px;
}
.left_box_percentage {
  flex: 1;
  margin: 0 10px;
}
.left_box_fileName {
  margin: 0 10px;
  font-weight: bold;
  font-size: 18px;
}
.rightBtn {
  display: flex;
  font-size: 14px;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  flex-basis: 180px;
  margin-top: -24px;
}
.my_btn {
  padding: 2px 10px;
  height: 24px;
  border-radius: 8px;
  display: flex;
  cursor: pointer;
  margin: 10px 8px;
  opacity: 0.8;
  display: flex;
  justify-content: center;
  align-items: center;
  user-select: none;
  min-width: 48px;
}
.my_btn:hover {
  opacity: 1;
}
.blueBtn {
  background-color: #409eff;
}
.redBtn {
  background-color: #f56c6c;
}
.bottom_hint {
  opacity: 0.8;
  display: flex;
  align-items: center;
}
</style>
