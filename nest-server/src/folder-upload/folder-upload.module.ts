import { Module } from '@nestjs/common';
import { FolderUploadController } from './folder-upload.controller';
import { FolderUploadService } from './folder-upload.service';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [
    MulterModule.register({
      dest: 'uploads',
    }),
  ],
  controllers: [FolderUploadController],
  providers: [FolderUploadService],
  exports: [FolderUploadService], // 导出服务，方便其他模块使用
})
export class FolderUploadModule {} 