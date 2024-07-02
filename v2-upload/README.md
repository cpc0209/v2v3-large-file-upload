# 该版本为最基础也是最通用的大文件上传，有两个版本vue2跟vue3版本

### 使用之前要注意public里面的文件，包括 hash-worker.js 跟 spark-md5.js
#### hash-worker.js是计算文件hash脚本
#### spark-md5.js 是 spark-md5插件，用于给文件计算hash值

至于怎么封装成组件暴露出去，可根据业务自行封装，关于基础版因为过于简单不做vue3写法处理
以及文字提示、文件为空、文件限制等

该版本只要实现大文件切片上传 + 进度条显示， 不做断点续传，以及 秒传等
前端使用element-ui  + axios
到时候用vue3需要的把element-ui换成element-plus即可

后端使用 node + express + fs-extra + multiparty 实现，代码较为简单



目前不做vite工具的上传，原理跟webpack一直，
区别之处只有 [引入路径] 跟 [worker] 部分可能有区分
具体参考webpack跟vite官方文档即可

webpack5：https://webpack.docschina.org/guides/web-workers/#root


webpack4：使用worker需要用到  worker-loader 模块，参考官方文档使用即可

vite:https://cn.vitejs.dev/guide/features.html#web-workers



