import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FolderUploadService {
  private readonly uploadDir: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    // 确保上传目录存在
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async processUploadedFolder(files, folderName: string) {
    try {
      if (!files || !Array.isArray(files)) {
        throw new Error('无效的文件列表');
      }

      // 处理文件数组，保持原始路径结构
      const uploadedFiles = await Promise.all(files.map(async file => {
        if (!file || !file.path) {
          throw new Error('无效的文件对象');
        }

        try {
          // 规范化路径
          const relativePath = file.relativePath.replace(/\\/g, '/');
          const serverPath = path.join(process.cwd(), 'uploads', relativePath);
          
          // 确保文件路径正确
          const fileDir = path.dirname(serverPath);
          if (!fs.existsSync(fileDir)) {
            fs.mkdirSync(fileDir, { recursive: true });
          }

          // 如果文件不在正确的位置，移动它
          if (file.path !== serverPath) {
            // 确保目标目录存在
            const targetDir = path.dirname(serverPath);
            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true });
            }

            // 如果目标文件已存在，先删除
            if (fs.existsSync(serverPath)) {
              fs.unlinkSync(serverPath);
            }

            // 使用流的方式复制文件
            const readStream = fs.createReadStream(file.path);
            const writeStream = fs.createWriteStream(serverPath);
            
            await new Promise((resolve, reject) => {
              readStream.pipe(writeStream)
                .on('finish', () => resolve(undefined))
                .on('error', reject);
            });
            
            // 删除临时文件
            try {
              fs.unlinkSync(file.path);
            } catch (unlinkError) {
              console.warn('删除临时文件失败:', unlinkError);
            }
          }
          
          return {
            originalName: file.originalname,
            filename: path.basename(file.filename || file.originalname),
            relativePath: relativePath,
            serverPath: serverPath,
            size: file.size,
            mimetype: file.mimetype,
            directory: path.dirname(relativePath)
          };
        } catch (error) {
          console.error('处理文件时出错:', error);
          throw new Error(`处理文件 ${file.originalname} 时出错: ${error.message}`);
        }
      }));

      // 构建目录树结构
      const folderStructure = this.buildFolderStructure(uploadedFiles);

      return {
        code: 0,
        success: true,
        message: '文件上传成功',
        folderName,
        files: uploadedFiles,
        structure: folderStructure,
        totalFiles: uploadedFiles.length
      };
    } catch (error) {
      console.error('处理上传文件时出错:', error);
      throw new HttpException(
        {
          code: -1,
          message: error.message || '文件夹上传失败',
          success: false
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private buildFolderStructure(files) {
    try {
      const structure = {};

      // 按照路径长度排序，确保父目录先创建
      const sortedFiles = [...files].sort((a, b) => {
        const aDepth = a.relativePath.split('/').length;
        const bDepth = b.relativePath.split('/').length;
        return aDepth - bDepth;
      });

      sortedFiles.forEach(file => {
        if (!file.relativePath) {
          console.warn('文件缺少相对路径信息:', file.originalname);
          return;
        }

        // 分割路径并过滤掉空值和当前目录符号
        const pathParts = file.relativePath.split('/').filter(Boolean);
        
        // 从根节点开始构建目录树
        let current = structure;
        
        // 遍历路径的每一部分，除了最后一个（文件名）
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i];
          
          // 如果当前层级不存在，创建一个新的目录节点
          if (!current[part]) {
            current[part] = {
              type: 'directory',
              name: part,
              children: {}
            };
          } else if (current[part].type !== 'directory') {
            // 如果存在同名文件，添加类型后缀以区分
            const newName = `${part}_dir`;
            current[newName] = {
              type: 'directory',
              name: part,
              children: {}
            };
            current = current[newName].children;
            continue;
          }
          
          // 移动到下一层目录
          current = current[part].children;
        }

        // 处理文件
        const fileName = pathParts[pathParts.length - 1];
        if (fileName) {
          // 如果存在同名目录，添加类型后缀以区分
          let finalFileName = fileName;
          if (current[fileName] && current[fileName].type === 'directory') {
            finalFileName = `${fileName}_file`;
          }
          
          current[finalFileName] = {
            type: 'file',
            name: fileName,
            path: file.relativePath,
            serverPath: file.serverPath,
            size: file.size,
            mimetype: file.mimetype
          };
        }
      });

      return structure;
    } catch (error) {
      console.error('构建文件夹结构时出错:', error);
      return {}; // 返回空结构而不是抛出错误
    }
  }

  // 获取已上传的文件夹结构
  async getFolderStructure(folderName: string) {
    const basePath = path.join('uploads', folderName || '');
    
    if (!fs.existsSync(basePath)) {
      return {
        success: false,
        message: '文件夹不存在'
      };
    }

    const structure = this.buildFolderStructureFromDisk(basePath, folderName || '');
    
    return {
      success: true,
      structure
    };
  }

  private buildFolderStructureFromDisk(currentPath: string, relativePath: string) {
    const items = fs.readdirSync(currentPath);
    const result = {
      name: path.basename(currentPath),
      path: relativePath.replace(/\\/g, '/'),
      type: 'folder',
      children: []
    };

    for (const item of items) {
      const itemPath = path.join(currentPath, item);
      const itemRelativePath = path.join(relativePath, item).replace(/\\/g, '/');
      
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        result.children.push(
          this.buildFolderStructureFromDisk(itemPath, itemRelativePath)
        );
      } else {
        result.children.push({
          name: item,
          path: itemRelativePath,
          type: 'file',
          size: stats.size,
          lastModified: stats.mtime
        });
      }
    }

    return result;
  }

  async checkFolderExists(folderName: string) {
    const folderPath = path.join(this.uploadDir, folderName);
    const exists = fs.existsSync(folderPath);
    
    return {
      code: 0,
      success: true,
      exists,
      message: exists ? '文件夹已存在' : '文件夹不存在'
    };
  }
} 