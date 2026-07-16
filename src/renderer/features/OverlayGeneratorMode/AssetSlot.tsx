import React from 'react';
import { Image as ImageIcon, RefreshCw, Trash2 } from 'lucide-react';
import type { OverlayAsset } from '@/features/OverlayGeneratorMode/types';

interface AssetSlotProps {
  label: string;
  asset: OverlayAsset | null;
  active: boolean;
  locked: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onReplace: () => void;
  onClear: () => void;
}

/** 通用素材槽位，展示缩略图、文件名和原图尺寸。 */
const AssetSlot: React.FC<AssetSlotProps> = ({
  label,
  asset,
  active,
  locked,
  disabled = false,
  onSelect,
  onReplace,
  onClear,
}) => (
  <div
    className={`rounded-xl border p-2.5 transition-colors ${
      active ? 'border-amber-500/70 bg-amber-500/10' : 'border-slate-800 bg-black/40'
    }`}
  >
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-2.5 text-left"
      disabled={disabled}
    >
      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
        {asset?.thumbnail || asset?.previewUrl ? (
          <img
            src={asset.thumbnail || asset.previewUrl || undefined}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <ImageIcon className="h-5 w-5 text-slate-600" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-slate-200">{label}</span>
          {locked && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] text-amber-400">已锁定</span>}
        </div>
        <p className="mt-1 truncate text-[11px] text-slate-400">{asset?.name || '暂无素材'}</p>
        <p className="mt-0.5 text-[10px] text-slate-600">
          {asset ? `${asset.width} × ${asset.height}` : '点击替换或拖入图片'}
        </p>
      </div>
    </button>
    <div className="mt-2 grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={onReplace}
        disabled={disabled}
        aria-label={`替换${label}`}
        title={`替换${label}`}
        className="flex items-center justify-center gap-1 rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1.5 text-[10px] text-slate-300 transition-colors hover:border-amber-500/40 hover:text-amber-300 disabled:opacity-40"
      >
        <RefreshCw className="h-3 w-3" />
        替换
      </button>
      <button
        type="button"
        onClick={onClear}
        disabled={disabled || !asset}
        aria-label={`清除${label}`}
        title={`清除${label}`}
        className="flex items-center justify-center gap-1 rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-1.5 text-[10px] text-slate-400 transition-colors hover:border-rose-500/40 hover:text-rose-300 disabled:opacity-40"
      >
        <Trash2 className="h-3 w-3" />
        清除
      </button>
    </div>
  </div>
);

export default AssetSlot;
