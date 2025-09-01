import { Controller, Post, UseInterceptors, UploadedFiles, Body, HttpException, HttpStatus } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FolderUploadService } from './folder-upload.service';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

@Controller('folder-upload')
export class FolderUploadController {
  constructor(private readonly folderUploadService: FolderUploadService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 100, {
      storage: diskStorage({
        destination: (req, file, cb) => {
          try {
            // 解析请求体中的路径信息
            let paths;
            try {
              paths = JSON.parse(req.body.paths);
            } catch {
              paths = req.body.paths || [];
            }

            // 获取文件索引
            const fileIndex = parseInt(file.fieldname.replace('files[', '').replace(']', '')) || 0;
            const relativePath = paths[fileIndex];

            if (!relativePath) {
              // 如果没有相对路径，说明是直接上传的文件
              const folderName = req.body.folderName || 'uploads';
              return cb(null, path.join(process.cwd(), 'uploads', folderName));
            }

            // 规范化路径分隔符并移除开头的斜杠
            const normalizedPath = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
            
            // 获取目录路径
            const dirPath = path.dirname(normalizedPath);
            
            // 构建目标目录的完整路径
            const targetDir = path.join(process.cwd(), 'uploads', dirPath);

            // 确保目录存在
            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true });
            }

            cb(null, targetDir);
          } catch (error) {
            console.error('Error in destination handler:', error);
            // 发生错误时使用默认上传目录
            const uploadDir = path.join(process.cwd(), 'uploads');
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }
            cb(null, uploadDir);
          }
        },
        filename: (req, file, cb) => {
          try {
            // 解析请求体中的路径信息
            let paths;
            try {
              paths = JSON.parse(req.body.paths);
            } catch {
              paths = req.body.paths || [];
            }

            // 获取文件索引
            const fileIndex = parseInt(file.fieldname.replace('files[', '').replace(']', '')) || 0;
            const relativePath = paths[fileIndex];

            if (!relativePath) {
              // 如果没有相对路径，使用原始文件名
              return cb(null, file.originalname);
            }

            // 规范化路径分隔符并移除开头的斜杠
            const normalizedPath = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
            
            // 获取文件名
            const fileName = path.basename(normalizedPath);
            cb(null, fileName);
          } catch (error) {
            console.error('Error in filename handler:', error);
            cb(null, file.originalname);
          }
        },
      }),
    }),
  )
  async uploadFolder(@UploadedFiles() files, @Body() body) {
    try {
      if (!files || files.length === 0) {
        throw new HttpException('没有接收到文件', HttpStatus.BAD_REQUEST);
      }

      // 解析路径信息
      let paths;
      try {
        paths = JSON.parse(body.paths);
      } catch {
        paths = body.paths || [];
      }

      const folderName = body.folderName;
      if (!folderName) {
        throw new HttpException('缺少文件夹名称', HttpStatus.BAD_REQUEST);
      }

      // 将文件信息和路径信息组合
      const fileInfos = files.map((file, index) => {
        // 使用原始的相对路径，确保保持目录结构
        const relativePath = paths[index] || path.join(folderName, file.originalname);
        // 规范化路径分隔符并移除开头的斜杠
        const normalizedPath = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
        
        // 构建正确的服务器路径
        const serverPath = path.join(process.cwd(), 'uploads', normalizedPath);
        
        // 确保文件路径正确
        const fileDir = path.dirname(serverPath);
        if (!fs.existsSync(fileDir)) {
          fs.mkdirSync(fileDir, { recursive: true });
        }

        return {
          ...file,
          relativePath: normalizedPath,
          originalPath: normalizedPath,
          directory: path.dirname(normalizedPath),
          serverPath: serverPath
        };
      });

      const result = await this.folderUploadService.processUploadedFolder(fileInfos, folderName);
      
      if (!result.success) {
        throw new HttpException(result.message, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return {
        code: 0,
        success: true,
        message: '文件上传成功',
        data: result
      };

    } catch (error) {
      console.error('Upload error:', error);
      throw new HttpException(
        {
          code: -1,
          message: error.message || '文件上传失败',
          success: false
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
} 