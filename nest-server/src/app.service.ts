import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Nest.js 大文件上传服务已启动!';
  }
} 