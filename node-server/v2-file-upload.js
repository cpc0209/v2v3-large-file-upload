const express = require('express')
const app = express()
const port = 3000
const path = require('path')
const fse = require('fs-extra')
const multiparty = require('multiparty')

app.use((req, res, next) => {
  // 请求头允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  next()
})

app.options('*', (req, res) => {
  res.sendStatus(200)
})

app.listen(port, () => console.log('v2基础大文件上传：监听3000端口'))

// 大文件存储目录
const UPLOAD_DIR = path.resolve(__dirname, 'target')

// 创建临时文件夹用于临时存储 所有的文件切片
const getChunkDir = (fileHash) => {
  // 添加 chunkCache 前缀与文件名做区分
  // target/chunkCache_fileHash值
  return path.resolve(UPLOAD_DIR, `chunkCache_${fileHash}`)
}

// 处理切片上传
app.post('/upload', async (req, res) => {
  try {
    // 处理文件表单
    const form = new multiparty.Form()
    form.parse(req, async (err, fields, files) => {
      if (err) {
        res.send({ code: -1, msg: '单片上传失败', data: err })
        return false
      }
      // fields是body参数
      // 文件hash ，切片hash ，文件名
      const { fileHash, chunkHash, fileName } = fields
      // files是传过来的文件所在的真实路径以及内容
      const { chunkFile } = files

      // 创建一个临时文件目录用于 临时存储所有文件切片
      const chunkCache = getChunkDir(fileHash)

      // 检查 chunkDir临时文件目录 是否存在，如果不存在则创建它。
      if (!fse.existsSync(chunkCache)) {
        await fse.mkdirs(chunkCache)
      }

      //   将上传的文件切片移动到指定的存储文件目录
      //  fse.move 方法默认不会覆盖已经存在的文件。
      //   将 overwrite: true 设置为 true，这样当目标文件已经存在时，将会被覆盖。
      //   把上传的文件移动到 /target/chunkCache_ + chunkHash
      await fse.move(chunkFile[0].path, `${chunkCache}/${chunkHash}`, {
        overwrite: true,
      })
      res.send({
        code: 0,
        msg: '单片上传完成',
        data: { fileHash, chunkHash, fileName },
      })
    })
  } catch (errB) {
    res.send({ code: -1, msg: '单片上传失败', data: errB })
  }
})

// 处理请求参数
const resolvePost = (req) => {
  // 所有接收到的数据块拼接成一个字符串，然后解析为 JSON 对象。
  return new Promise((resolve) => {
    let body = [] // 使用数组而不是字符串来避免大字符串的内存问题
    // 监听请求对象 req 的 data 事件。每当有数据块传输过来时，处理程序就会被调用。
    req.on('data', (data) => {
      // 假设数据是 Buffer，将其追加到数组中
      body.push(data)
    })
    // 监听请求对象 req 的 end 事件。当所有数据块接收完毕时
    req.on('end', () => {
      // 使用 Buffer.concat 将所有数据块合并为一个 Buffer
      const buffer = Buffer.concat(body)
      // 将 Buffer 转换为字符串（假设是 UTF-8 编码）
      const stringData = buffer.toString('utf8')
      try {
        // 尝试解析 JSON 字符串
        const parsedData = JSON.parse(stringData)
        // 如果解析成功，则 resolve
        resolve(parsedData)
      } catch (error) {
        // 如果解析失败，则 reject
        reject(new Error('参数解析失败'))
      }
      // 可以添加一个 'error' 事件监听器来处理任何可能出现的错误
      req.on('error', (error) => {
        reject(error)
      })
    })
  })
}

// 把文件切片写成总的一个文件流
const pipeStream = (path, writeStream) => {
  return new Promise((resolve) => {
    // 创建可读流
    const readStream = fse.createReadStream(path).on('error', (err) => {
      // 如果在读取过程中发生错误，拒绝 Promise
      reject(err)
    })
    // 在一个指定位置写入文件流
    readStream.pipe(writeStream).on('finish', () => {
      // 写入完成后，删除原切片文件
      fse.unlinkSync(path)
      resolve()
    })
  })
}

// 合并切片
const mergeFileChunk = async (chunkSize, fileHash, filePath) => {
  try {
    // target/chunkCache_fileHash值
    const chunkCache = getChunkDir(fileHash)
    // 读取 临时所有切片目录 chunkCache 下的所有文件和子目录，并返回这些文件和子目录的名称。
    const chunkPaths = await fse.readdir(chunkCache)

    // 根据切片下标进行排序
    // 否则直接读取目录的获得的顺序会错乱
    chunkPaths.sort((a, b) => a.split('-')[1] - b.split('-')[1])

    let promiseList = []
    for (let index = 0; index < chunkPaths.length; index++) {
      // target/chunkCache_hash值/文件切片位置
      let chunkPath = path.resolve(chunkCache, chunkPaths[index])
      // 根据 index * chunkSize 在指定位置创建可写流
      let writeStream = fse.createWriteStream(filePath, {
        start: index * chunkSize,
      })
      promiseList.push(pipeStream(chunkPath, writeStream))
    }

    // 使用 Promise.all 等待所有 Promise 完成
    // (相当于等待所有的切片已写入完成且删除了所有的切片文件)
    Promise.all(promiseList)
      .then(() => {
        console.log('所有文件切片已成功处理并删除')
        // 在这里执行所有切片处理完成后的操作
        // 递归删除缓存切片目录及其内容 (注意，如果删除不存在的内容会报错)
        if (fse.pathExistsSync(chunkCache)) {
          fse.remove(chunkCache)
          console.log(`chunkCache缓存目录删除成功`)
          // 合并成功，返回 Promise.resolve
          return Promise.resolve()
        } else {
          console.log(`${chunkCache} 不存在，不能删除`)

          return Promise.reject(`${chunkCache} 不存在，不能删除`)
        }
      })
      .catch((err) => {
        console.error('文件处理过程中发生错误：', err)
        // 在这里处理错误，可能需要清理资源等
        return Promise.reject(`'文件处理过程中发生错误：${err}`)
      })
  } catch (err) {
    console.log(err, '合并切片函数失败')
    return Promise.reject(`'合并切片函数失败：${err}`)
  }
}

// 提取文件后缀名
const extractExt = (fileName) => {
  // 查找'.'在fileName中最后出现的位置
  const lastIndex = fileName.lastIndexOf('.')
  // 如果'.'不存在，则返回空字符串
  if (lastIndex === -1) {
    return ''
  }
  // 否则，返回从'.'后一个字符到fileName末尾的子串作为文件后缀（包含'.'）
  return fileName.slice(lastIndex)
}

// 合并接口
app.post('/merge', async (req, res) => {
  // 在上传完所有切片后就要调合并切片
  try {
    // 处理所有参数
    const data = await resolvePost(req)
    // 切片大小 文件名 文件hash
    const { chunkSize, fileName, fileHash } = data
    // 提取文件后缀名
    const ext = extractExt(fileName)
    // 整个文件路径 /target/文件hash.文件后缀
    const filePath = path.resolve(UPLOAD_DIR, `${fileHash}${ext}`)
    // 开始合并切片
    await mergeFileChunk(chunkSize, fileHash, filePath)
    res.send({
      code: 0,
      msg: '文件合并成功',
    })
  } catch (err) {
    res.send({
      code: -1,
      data: err,
      msg: '文件合并失败！',
    })
  }
})
