export interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VideoFile {
  id: string;
  file: File;
  name: string;
  originalName?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  url?: string;
  blobUrl?: string;
  blobUrls?: string[];
}

export interface ComposerState {
  bgImage: string | null;
  videos: VideoFile[];
  overlayPos: Position;
  isBatchProcessing: boolean;
}

export interface ProcessProgress {
  current: number;
  total: number;
  message: string;
}

export interface ProcessResult {
  success: boolean;
  outputPath?: string;
  error?: string;
}
