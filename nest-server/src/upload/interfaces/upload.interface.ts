export interface UploadedChunk {
  fileHash: string;
  chunkHash: string;
  fileName: string;
}

export interface VerifyResult {
  shouldUpload: boolean;
  uploadedList: string[];
} 