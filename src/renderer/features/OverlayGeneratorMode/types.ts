import type {
  OverlayCropTransform,
  OverlayExportOptions,
  OverlayTemplateMode,
} from '@shared/overlay';

export type OverlayEditingTarget = 'first' | 'video' | 'second';
export type OverlayTaskStatus =
  | 'pending'
  | 'editing'
  | 'ready'
  | 'exporting'
  | 'success'
  | 'failed'
  | 'cancelled';

/** 渲染进程保存的轻量素材信息；原图不会转成 Base64。 */
export interface OverlayAsset {
  path: string;
  name: string;
  width: number;
  height: number;
  thumbnail: string | null;
  previewUrl: string | null;
}

/** 页面内一张贴片成品的完整编辑状态。 */
export interface OverlayEditorTask {
  id: string;
  name: string;
  mode: OverlayTemplateMode;
  firstAsset: OverlayAsset | null;
  secondAsset: OverlayAsset | null;
  sameSource: boolean;
  position: number;
  firstTransform: OverlayCropTransform;
  secondTransform: OverlayCropTransform;
  firstLocked: boolean;
  secondLocked: boolean;
  selected: boolean;
  status: OverlayTaskStatus;
  error: string | null;
  exportOptions: OverlayExportOptions;
  taskCenterId?: number;
  progress: number;
  outputs: string[];
}

export interface OverlayConfirmAction {
  title: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
}
