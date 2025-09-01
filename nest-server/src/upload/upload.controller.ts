import { Controller, Post, Req, Body, HttpException, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { UploadService } from './upload.service';
import { MergeDto } from './dto/merge.dto';
import { VerifyDto } from './dto/verify.dto';

@Controller()
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * 处理文件切片上传
   * @param req Express请求对象
   * @returns 上传结果
   */
  @Post('upload')
  async uploadChunk(@Req() req: Request) {
    try {
      return await this.uploadService.handleUpload(req);
    } catch (error) {
      throw new HttpException(
        {
          code: -1,
          msg: '单片上传失败',
          data: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 合并文件切片
   * @param mergeDto 合并参数
   * @returns 合并结果
   */
  @Post('merge')
  async mergeChunks(@Body() mergeDto: MergeDto) {
    return this.uploadService.handleMerge(mergeDto);
  }

  /**
   * 验证文件是否存在
   * @param verifyDto 验证参数
   * @returns 验证结果
   */
  @Post('verify')
  async verifyFile(@Body() verifyDto: VerifyDto) {
    return this.uploadService.verifyFile(verifyDto);
  }
} 