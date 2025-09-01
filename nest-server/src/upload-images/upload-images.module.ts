import { Module } from '@nestjs/common';
import { UploadImagesController } from './upload-images.controller';
import { UploadImagesService } from './upload-images.service';

@Module({
  controllers: [UploadImagesController],
  providers: [UploadImagesService],
}) export class UploadImagesModule {}