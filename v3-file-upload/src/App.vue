<template>
  <div class="page">
    <div class="page_top">
      <p>正在上传 ({{ statistics }})</p>
      <div
        class="page_top_right"
        :style="{
          'justify-content':
            uploadFileList.length > 1 ? 'space-between' : 'flex-end',
        }">
        <p
          class="clear_btn"
          @click="cancelAll"
          v-if="uploadFileList.length > 1">
          全部取消
        </p>
      </div>
    </div>
    <div class="content" ref="contentRef">
      <ListItem
        :uploadFileList="uploadFileList"
        @pauseUpload="pauseUpload"
        @resumeUpload="resumeUpload"
        @cancelSingle="cancelSingle" />
    </div>

    <div class="bottom_box">
      <div class="input_btn">
        选择文件上传
        <input
          type="file"
          multiple
          class="is_input"
          @change="hanldeUploadFile" />
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, reactive, computed } from 'vue'
import { uploadFile, checkFile, mergeChunk } from '@/api/index.js'
import ListItem from '@/components/ListItem/index.vue'
// 1kb = 1024b   1kb * 1024 = 1M
// 切片大小 1 * 1024 * 1024 刚好1M
const chunkSize = 1 * 1024 * 1024
// 上传文件列表
const uploadFileList = ref([])
// 请求最大并发数
const maxRequest = ref(6)

const statistics = computed(() => {
  // 正在上传的文件个数 / 上传总数
  const otherArr = uploadFileList.value.filter((item) => item.state !== 4)
  return `${otherArr.length}/${uploadFileList.value.length}`
})

// 生成文件 hash（web-worker）
const useWorker = (file) => {
  return new Promise((resolve) => {
    const worker = new Worker(
      new URL('@/worker/hash-worker.js', import.meta.url)
      // {
      //   type: 'module',
      // }
    )
    worker.postMessage({ file, chunkSize: chunkSize })
    worker.onmessage = (e) => {
      const { fileHash, fileChunkList } = e.data
      if (fileHash) {
        resolve({
          fileHash,
          fileChunkList,
        })
      }
    }
  })
}

// 暂停上传（是暂停剩下未上传的）
const pauseUpload = (taskArrItem, elsePause = true) => {
  // elsePause为true就是主动暂停，为false就是请求中断
  // 4是成功 6是失败  如果不是成功或者失败状态，
  if (![4, 6].includes(taskArrItem.state)) {
    // 3是暂停，5是中断
    if (elsePause) {
      taskArrItem.state = 3
    } else {
      taskArrItem.state = 5
    }
  }
  taskArrItem.errNumber = 0

  // 取消还在请求中的所有接口
  if (taskArrItem.whileRequests.length > 0) {
    for (const itemB of taskArrItem.whileRequests) {
      itemB.cancel ? itemB.cancel() : ''
    }
  }
  // // 所有剩下的请求都触发取消请求
  // for (const itemB of item.allChunkList) {
  //   //  如果cancel是函数则触发取消函数
  //   itemB.cancel ? itemB.cancel() : ''
  // }
}

// 继续上传
const resumeUpload = (taskArrItem) => {
  // 2为上传中
  taskArrItem.state = 2
  // 把刚才暂停的正在上传中所有切片放到待上传切片列表中
  taskArrItem.allChunkList.push(...taskArrItem.whileRequests)
  taskArrItem.whileRequests = []
  uploadSignleFile(taskArrItem)
}

// 取消单个
const cancelSingle = async (taskArrItem) => {
  pauseUpload(taskArrItem)
  // 取消上传后列表删除该文件
  uploadFileList.value = uploadFileList.value.filter(
    (itemB) => itemB.fileHash !== taskArrItem.fileHash
  )
}

// 全部取消
const cancelAll = () => {
  for (const item of uploadFileList.value) {
    pauseUpload(item)
  }

  uploadFileList.value = []
}

// 调取合并接口处理所有切片
const handleMerge = async (taskArrItem) => {
  const { fileName, fileHash } = taskArrItem
  const res = await mergeChunk({
    chunkSize: chunkSize,
    fileName,
    fileHash,
  }).catch(() => {})
  //  如果合并成功则标识该文件已经上传完成

  if (res && res.code === 0) {
    // 设置文件上传状态
    finishTask(taskArrItem)
    console.log('文件合并成功！')
  } else {
    // 否则暂停上传该文件
    pauseUpload(taskArrItem, true)
    console.log('文件合并失败！')
  }
  // 最后赋值文件切片上传完成个数为0
  taskArrItem.finishNumber = 0
}

// 更新单个文件进度条
const signleFileProgress = (needObj, taskArrItem) => {
  // 即使是超时请求也是会频繁的返回上传进度的,所以只能写成完成一片就添加它所占百分之多少,否则会造成误会
  taskArrItem.percentage = Number(
    ((taskArrItem.finishNumber / needObj.chunkNumber) * 100).toFixed(2)
  )
}

// 设置单个文件上传已完成
const finishTask = (item) => {
  item.percentage = 100
  // 4是上传完成
  item.state = 4
}

// 单个文件上传
const uploadSignleFile = (taskArrItem) => {
  // 如果没有需要上传的切片 / 正在上传的切片还没传完，就不做处理
  if (
    taskArrItem.allChunkList.length === 0 ||
    taskArrItem.whileRequests.length > 0
  ) {
    return false
  }
  // 找到文件处于处理中/上传中的 文件列表（是文件而不是切片）
  const isTaskArrIng = uploadFileList.value.filter(
    (itemB) => itemB.state === 1 || itemB.state === 2
  )

  // 实时动态获取并发请求数,每次调请求前都获取一次最大并发数
  // 浏览器同域名同一时间请求的最大并发数限制为6
  // 例如如果有3个文件同时上传/处理中，则每个文件切片接口最多调 6 / 3 == 2个相同的接口
  maxRequest.value = Math.ceil(6 / isTaskArrIng.length)

  // 从数组的末尾开始提取 maxRequest 个元素。
  let whileRequest = taskArrItem.allChunkList.slice(-maxRequest.value)

  // 设置正在请求中的个数
  taskArrItem.whileRequests.push(...whileRequest)
  //  如果总请求数大于并发数
  if (taskArrItem.allChunkList.length > maxRequest.value) {
    // 则减去并发数
    taskArrItem.allChunkList.splice(-maxRequest.value)
  } else {
    // 否则总请求数置空,说明已经把没请求的全部放进请求列表了，不需要做过多请求
    taskArrItem.allChunkList = []
  }

  // 单个分片请求
  const uploadChunk = async (needObj) => {
    const fd = new FormData()
    const {
      fileHash,
      fileSize,
      fileName,
      index,
      chunkFile,
      chunkHash,
      chunkSize,
      chunkNumber,
    } = needObj

    fd.append('fileHash', fileHash)
    fd.append('fileSize', String(fileSize))
    fd.append('fileName', fileName)
    fd.append('index', String(index))
    fd.append('chunkFile', chunkFile)
    fd.append('chunkHash', chunkHash)
    fd.append('chunkSize', String(chunkSize))
    fd.append('chunkNumber', String(chunkNumber))
    const res = await uploadFile(fd, (onCancelFunc) => {
      // 在调用接口的同时，相当于同时调用了传入的这个函数，又能同时拿到返回的取消方法去赋值
      needObj.cancel = onCancelFunc
    }).catch(() => {})
    // 先判断是不是处于暂停还是取消状态
    // 你的状态都已经变成暂停或者中断了,就什么都不要再做了,及时停止
    if (taskArrItem.state === 3 || taskArrItem.state === 5) {
      return false
    }

    // 请求异常,或者请求成功服务端返回报错都按单片上传失败逻辑处理,.then.catch的.catch是只能捕捉请求异常的
    if (!res || res.code === -1) {
      taskArrItem.errNumber++
      // 超过3次之后直接上传中断
      if (taskArrItem.errNumber > 3) {
        console.log('切片上传失败超过三次了')
        pauseUpload(taskArrItem, false) // 上传中断
      } else {
        console.log('切片上传失败还没超过3次')
        uploadChunk(needObj) // 失败了一片,继续当前分片请求
      }
    } else if (res.code === 0) {
      // 单个文件上传失败次数大于0则要减少一个
      taskArrItem.errNumber > 0 ? taskArrItem.errNumber-- : 0
      // 单个文件切片上传成功数+1
      taskArrItem.finishNumber++
      // 单个切片上传完成
      needObj.finish = true
      signleFileProgress(needObj, taskArrItem) // 更新进度条
      // 上传成功了就删掉请求中数组中的那一片请求
      taskArrItem.whileRequests = taskArrItem.whileRequests.filter(
        (item) => item.chunkFile !== needObj.chunkFile
      )

      // 如果单个文件最终成功数等于切片个数
      if (taskArrItem.finishNumber === chunkNumber) {
        // 全部上传完切片后就开始合并切片
        handleMerge(taskArrItem)
      } else {
        // 如果还没完全上传完，则继续上传
        uploadSignleFile(taskArrItem)
      }
    }
  }

  // 开始单个上传
  for (const item of whileRequest) {
    uploadChunk(item)
  }
}

// 输入框change事件
const hanldeUploadFile = async (e) => {
  const fileEle = e.target
  // 如果没有文件内容
  if (!fileEle || !fileEle.files || fileEle.files.length === 0) {
    return false
  }
  const files = fileEle.files

  // 多文件
  Array.from(files).forEach(async (item, i) => {
    const file = item
    // 单个上传文件
    // 这里要注意vue2跟vue3不同，
    // 如果在循环 + await中，如果把一个普通对象push进一个响应式数组
    // 直接修改原对象可能不会触发vue的DOM视图更新（但最终值会改变）
    // 所以这里用了reactive做响应式代理
    let inTaskArrItem = reactive({
      id: new Date() + i, // 因为forEach是同步，所以需要用指定id作为唯一标识
      state: 0, // 0是什么都不做,1文件处理中,2是上传中,3是暂停,4是上传完成,5上传中断，6是上传失败
      fileHash: '',
      fileName: file.name,
      fileSize: file.size,
      allChunkList: [], // 所有请求的数据
      whileRequests: [], // 正在请求中的请求个数,目前是要永远都保存请求个数为6
      finishNumber: 0, //请求完成的个数
      errNumber: 0, // 报错的个数,默认是0个,超多3个就是直接上传中断
      percentage: 0, // 单个文件上传进度条
      cancel: null, // 用于取消切片上传接口
    })
    uploadFileList.value.push(inTaskArrItem)
    // 如果不使用reactive，就得使用以下两种方式
    // inTaskArrItem = uploadFileList.value[i]
    // uploadFileList.value[i].state = 2
    // 开始处理解析文件
    inTaskArrItem.state = 1

    if (file.size === 0) {
      // 文件大小为0直接上传失败
      inTaskArrItem.state = 6
      // 上传中断
      pauseUpload(inTaskArrItem, false)
    }
    console.log('文件开始解析')

    // 计算文件hash
    const { fileHash, fileChunkList } = await useWorker(file)

    console.log(fileHash, '文件hash计算完成')

    // 解析完成开始上传文件
    let baseName = ''
    // 查找'.'在fileName中最后出现的位置
    const lastIndex = file.name.lastIndexOf('.')
    // 如果'.'不存在，则返回整个文件名
    if (lastIndex === -1) {
      baseName = file.name
    }
    // 否则，返回从fileName开始到'.'前一个字符的子串作为文件名（不包含'.'）
    baseName = file.name.slice(0, lastIndex)

    // 这里要注意！可能同一个文件，是复制出来的，出现文件名不同但是内容相同，导致获取到的hash值也是相同的
    // 所以文件hash要特殊处理
    inTaskArrItem.fileHash = `${fileHash}${baseName}`
    inTaskArrItem.state = 2
    console.log(uploadFileList.value, 'uploadFileList.value')
    // 上传之前要检查服务器是否存在该文件
    try {
      const res = await checkFile({
        fileHash: `${fileHash}${baseName}`,
        fileName: file.name,
      })

      if (res.code === 0) {
        const { shouldUpload, uploadedList } = res.data

        if (!shouldUpload) {
          finishTask(inTaskArrItem)
          console.log('文件已存在，实现秒传')
          return false
        }

        inTaskArrItem.allChunkList = fileChunkList.map((item, index) => {
          return {
            // 总文件hash
            fileHash: `${fileHash}${baseName}`,
            // 总文件size
            fileSize: file.size,
            // 总文件name
            fileName: file.name,
            index: index,
            // 切片文件本身
            chunkFile: item.chunkFile,
            // 单个切片hash,以 - 连接
            chunkHash: `${fileHash}-${index}`,
            // 切片文件大小
            chunkSize: chunkSize,
            // 切片个数
            chunkNumber: fileChunkList.length,
            // 切片是否已经完成
            finish: false,
          }
        })

        // 如果已存在部分文件切片，则要过滤调已经上传的切片
        if (uploadedList.length > 0) {
          // 过滤掉已经上传过的切片
          inTaskArrItem.allChunkList = inTaskArrItem.allChunkList.filter(
            (item) => !uploadedList.includes(item.chunkHash)
          )

          // 如果存在需要上传的，但是又为空，可能是因为还没合并，
          if (!inTaskArrItem.allChunkList.length) {
            // 所以需要调用合并接口
            await handleMerge(inTaskArrItem)
            return false
          } else {
            // 同时要注意处理切片数量
            inTaskArrItem.allChunkList = inTaskArrItem.allChunkList.map(
              (item) => {
                return {
                  ...item,
                  chunkNumber: inTaskArrItem.allChunkList.length,
                }
              }
            )
          }
        }

        // 逐步对单个文件进行切片上传
        uploadSignleFile(inTaskArrItem)
      }
    } catch (err) {}
  })
}
</script>

<style scoped>
.page {
  margin: 0 auto;
  background-color: #28323e;
  width: 100%;
  height: 100vh;
  color: #ffffff;
  position: relative;
}
.page_top {
  height: 48px;
  padding: 0 48px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  color: #8386be;
}
.page_top_right {
  width: 260px;
  display: flex;
}
.page_top > p {
  padding: 12px;
}
.clear_btn {
  cursor: pointer;
  color: #853b3c;
  user-select: none;
}
.clear_btn:hover {
  cursor: pointer;
  color: #b65658;
}
.content {
  max-width: 1000px;
  margin: 0 auto;
  overflow-y: auto;
  height: calc(100vh - 128px);
  border-radius: 14px;
  background-color: #303944;
  border: 1px solid #252f3c;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5) inset;
}
.bottom_box {
  text-align: center;
  position: absolute;
  bottom: 0;
  left: 0;
  height: 80px;
  width: 100%;
  display: flex;
  align-items: center;
}
.input_btn > input {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}
.input_btn {
  width: 200px;
  background-color: #409eff;
  opacity: 0.8;
  position: relative;
  padding: 8px 16px;
  border-radius: 8px;
  margin: 0 auto;
  user-select: none;
}
.input_btn:hover {
  opacity: 1;
}
:deep(.messageBac) {
  position: fixed;
  width: 100%;
  top: 0;
  left: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
  transition: all 0.3s;
  transform: translateY(-34px);
  opacity: 0;
}
:deep(.messageShow) {
  transform: translateY(20px);
  opacity: 1;
}
:deep(.message) {
  background-color: #c7d1e5;
  color: #737a88;
  border-radius: 8px;
  padding: 4px 16px;
}
/* 滚动条 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-thumb {
  background-color: #404755;
  border-radius: 4px;
  cursor: pointer;
}
::-webkit-scrollbar-thumb:hover {
  background-color: #4d5564;
}
@keyframes fadeIn {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
</style>
