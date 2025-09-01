export class UploadDto {
  fileHash: string;
  fileSize: number;
  fileName: string;
  index: number;
  chunkHash: string;
  chunkSize: number;
  chunkNumber: number;
} 