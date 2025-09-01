import { Injectable } from '@nestjs/common';

@Injectable()
export class UploadImagesService {
  uploadFiles() {
    return { success: true, message: '图片上传成功' };
  }
}