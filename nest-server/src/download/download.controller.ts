import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Controller('download')
export class DownloadController {
  private readonly targetDir: string;

  constructor() {
    // 使用绝对路径
    this.targetDir = path.resolve(process.cwd(), 'target');
    console.log('当前工作目录:', process.cwd());
    console.log('目标目录:', this.targetDir);
    
    // 确保目录存在
    if (!fs.existsSync(this.targetDir)) {
      console.log('创建目标目录');
      fs.mkdirSync(this.targetDir, { recursive: true });
    }

    // 列出目录内容
    this.listDirectoryContents();
  }

  private listDirectoryContents() {
    try {
      console.log('目录内容:');
      const files = fs.readdirSync(this.targetDir);
      files.forEach(file => {
        const filePath = path.join(this.targetDir, file);
        const stats = fs.statSync(filePath);
        console.log(`- ${file} (${stats.size} bytes)`);
      });
    } catch (error) {
      console.error('列出目录内容失败:', error);
    }
  }

  @Get(':filename')
  async downloadFile(@Param('filename') filename: string, @Res() res: Response) {
    try {
      // 解码文件名
      const decodedFilename = decodeURIComponent(filename);
      console.log('请求下载文件:', decodedFilename);
      
      const filePath = path.join(this.targetDir, decodedFilename);
      console.log('完整文件路径:', filePath);
      
      if (!fs.existsSync(filePath)) {
        console.log('文件不存在:', filePath);
        this.listDirectoryContents(); // 再次列出目录内容
        return res.status(200).json({ 
          code: 200,
          message: '',
          requestedFile: decodedFilename,
          data: fs.readdirSync(this.targetDir)
        });
      }

      const stat = fs.statSync(filePath);
      console.log('文件信息:', {
        size: stat.size,
        birthtime: stat.birthtime,
        mtime: stat.mtime
      });

      const fileSize = stat.size;
      console.log('fileSize :>> ', fileSize);
      const range = res.req.headers.range;
      console.log('range :>> ', range);

      if (range) {
        // 处理断点续传
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        console.log('断点续传:', { start, end, chunksize });
        
        const file = fs.createReadStream(filePath, { start, end });
        
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': 'application/octet-stream',
        });
        
        file.pipe(res);
      } else {
        // 普通下载
        console.log('普通下载');
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename=${encodeURIComponent(decodedFilename)}`,
          'Accept-Ranges': 'bytes', // 添加支持断点续传的响应头
        });
        
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (error) {
      console.error('下载文件出错:', error);
      return res.status(500).json({ 
        message: '下载文件失败',
        error: error.message 
      });
    }
  }

  @Get('list')
  async getFileList(@Res() res: Response) {
    try {
      console.log('获取文件列表，目标目录:', this.targetDir);
      
      if (!fs.existsSync(this.targetDir)) {
        console.log('目标目录不存在，返回空列表');
        return res.status(200).json({
          code: 200,
          data: [],
          message: 'success'
        });
      }

      const files = fs.readdirSync(this.targetDir);
      console.log('找到文件:', files);
      
      const fileList = files.map(filename => {
        try {
          const filePath = path.join(this.targetDir, filename);
          const stat = fs.statSync(filePath);
          
          // 只返回文件，不返回目录
          if (stat.isFile()) {
            return {
              filename,
              size: this.formatFileSize(stat.size),
              createdAt: stat.birthtime
            };
          }
          return null;
        } catch (error) {
          console.error(`处理文件 ${filename} 时出错:`, error);
          return null;
        }
      }).filter(file => file !== null);

      console.log('返回文件列表:', fileList);
      return res.status(200).json({
        code: 200,
        data: fileList,
        message: 'success'
      });
    } catch (error) {
      console.error('获取文件列表失败:', error);
      return res.status(500).json({ 
        code: 500,
        data: null,
        message: '获取文件列表失败',
        error: error.message 
      });
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
} 