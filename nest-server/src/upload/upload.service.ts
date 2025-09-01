import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fse from 'fs-extra';
import * as multiparty from 'multiparty';
import { Request } from 'express';
import { MergeDto } from './dto/merge.dto';
import { VerifyDto } from './dto/verify.dto';
import { VerifyResult } from './interfaces/upload.interface';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly UPLOAD_DIR = path.resolve(process.cwd(), 'target');

  constructor() {
    // 确保上传目录存在
    this.ensureUploadDir();
  }

  private ensureUploadDir() {
    if (!fse.existsSync(this.UPLOAD_DIR)) {
      fse.mkdirsSync(this.UPLOAD_DIR);
      this.logger.log(`创建上传目录: ${this.UPLOAD_DIR}`);
    }
  }

  /**
   * 获取切片存储目录
   * @param fileHash 文件哈希
   * @returns 切片存储目录路径
   */
  private getChunkDir(fileHash: string): string {
    return path.resolve(this.UPLOAD_DIR, `chunkCache_${fileHash}`);
  }

  /**
   * 处理文件上传请求
   * @param req Express请求对象
   * @returns 上传结果
   */
  async handleUpload(req: Request): Promise<any> {
    return new Promise((resolve, reject) => {
      const form = new multiparty.Form();
      
      form.parse(req, async (err, fields, files) => {
        if (err) {
          this.logger.error(`解析表单失败: ${err.message}`);
          return reject({ code: -1, msg: '单片上传失败', data: err });
        }
        
        try {
          // 从表单字段中提取数据
          const fileHash = fields.fileHash[0];
          const chunkHash = fields.chunkHash[0];
          const fileName = fields.fileName[0];
          const chunkFile = files.chunkFile[0];
          
          // 创建切片存储目录
          const chunkDir = this.getChunkDir(fileHash);
          if (!fse.existsSync(chunkDir)) {
            await fse.mkdirs(chunkDir);
          }
          
          // 移动上传的切片到存储目录
          const chunkPath = path.resolve(chunkDir, chunkHash);
          await fse.move(chunkFile.path, chunkPath, { overwrite: true });
          
          this.logger.log(`切片上传成功: ${chunkHash}`);
          resolve({
            code: 0,
            msg: '单片上传完成',
            data: { fileHash, chunkHash, fileName },
          });
        } catch (error) {
          this.logger.error(`处理切片上传失败: ${error.message}`);
          reject({ code: -1, msg: '单片上传失败', data: error });
        }
      });
    });
  }

  /**
   * 提取文件后缀名
   * @param fileName 文件名
   * @returns 文件后缀名（包含点）
   */
  private extractExt(fileName: string): string {
    const lastIndex = fileName.lastIndexOf('.');
    return lastIndex === -1 ? '' : fileName.slice(lastIndex);
  }

  /**
   * 将切片写入文件流
   * @param chunkPath 切片路径
   * @param writeStream 写入流
   * @returns Promise
   */
  private pipeStream(chunkPath: string, writeStream: fse.WriteStream): Promise<void> {
    return new Promise((resolve, reject) => {
      const readStream = fse.createReadStream(chunkPath);
      
      readStream.on('error', (err) => {
        this.logger.error(`读取切片失败: ${err.message}`);
        reject(err);
      });
      
      readStream.pipe(writeStream).on('finish', () => {
        // 写入完成后删除切片文件
        fse.unlinkSync(chunkPath);
        resolve();
      });
    });
  }

  /**
   * 合并文件切片
   * @param chunkSize 切片大小
   * @param fileHash 文件哈希
   * @param filePath 目标文件路径
   * @returns Promise
   */
  private async mergeFileChunk(chunkSize: number, fileHash: string, filePath: string): Promise<void> {
    try {
      const chunkDir = this.getChunkDir(fileHash);
      const chunkPaths = await fse.readdir(chunkDir);
      
      // 根据切片下标排序 - 修改排序逻辑，确保正确解析数字
      chunkPaths.sort((a, b) => {
        const indexA = a.split('-').length > 1 ? parseInt(a.split('-')[1]) : 0;
        const indexB = b.split('-').length > 1 ? parseInt(b.split('-')[1]) : 0;
        return indexA - indexB;
      });
      
      const promiseList = chunkPaths.map((chunkName, index) => {
        const chunkPath = path.resolve(chunkDir, chunkName);
        const writeStream = fse.createWriteStream(filePath, {
          start: index * chunkSize,
          flags: index === 0 ? 'w' : 'a', // 第一个切片创建文件，后续追加
        });
        
        return this.pipeStream(chunkPath, writeStream);
      });
      
      await Promise.all(promiseList);
      this.logger.log('所有文件切片已成功合并');
      
      // 清理切片目录
      if (fse.existsSync(chunkDir)) {
        await fse.remove(chunkDir);
        this.logger.log(`切片缓存目录已删除: ${chunkDir}`);
      }
    } catch (error) {
      this.logger.error(`合并文件切片失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 处理合并请求
   * @param mergeDto 合并参数
   * @returns 合并结果
   */
  async handleMerge(mergeDto: MergeDto): Promise<any> {
    try {
      const { chunkSize, fileName, fileHash } = mergeDto;
      const ext = this.extractExt(fileName);
      const filePath = path.resolve(this.UPLOAD_DIR, `${fileHash}${ext}`);
      
      await this.mergeFileChunk(chunkSize, fileHash, filePath);
      
      return {
        code: 0,
        msg: '文件合并成功',
      };
    } catch (error) {
      this.logger.error(`文件合并失败: ${error.message}`);
      return {
        code: -1,
        data: error,
        msg: '文件合并失败！',
      };
    }
  }

  /**
   * 获取已上传的切片列表
   * @param fileHash 文件哈希
   * @returns 切片名称数组
   */
  private async createUploadedList(fileHash: string): Promise<string[]> {
    const chunkDir = this.getChunkDir(fileHash);
    return fse.existsSync(chunkDir) ? await fse.readdir(chunkDir) : [];
  }

  /**
   * 验证文件是否已存在
   * @param verifyDto 验证参数
   * @returns 验证结果
   */
  async verifyFile(verifyDto: VerifyDto): Promise<{ code: number; data: VerifyResult; msg: string }> {
    try {
      const { fileHash, fileName } = verifyDto;
      const ext = this.extractExt(fileName);
      const filePath = path.resolve(this.UPLOAD_DIR, `${fileHash}${ext}`);
      
      if (fse.existsSync(filePath)) {
        // 文件已存在，不需要上传
        return {
          code: 0,
          data: {
            shouldUpload: false,
            uploadedList: [],
          },
          msg: '已存在该文件',
        };
      } else {
        // 返回已上传的切片列表
        return {
          code: 0,
          data: {
            shouldUpload: true,
            uploadedList: await this.createUploadedList(fileHash),
          },
          msg: '需要上传文件/部分切片',
        };
      }
    } catch (error) {
      this.logger.error(`验证文件失败: ${error.message}`);
      return {
        code: -1,
        data: {
          shouldUpload: true,
          uploadedList: [],
        },
        msg: '验证文件失败',
      };
    }
  }
} 