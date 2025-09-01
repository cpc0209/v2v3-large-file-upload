import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UploadModule } from './upload/upload.module';
import { FolderUploadModule } from './folder-upload/folder-upload.module';
import { DownloadModule } from './download/download.module';
import { UploadImagesModule } from './upload-images/upload-images.module';

@Module({
  imports: [UploadModule, FolderUploadModule, DownloadModule, UploadImagesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}