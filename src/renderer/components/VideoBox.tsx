import React from 'react';
import { Move, Maximize2 } from 'lucide-react';
import { Position } from '@/types';

/**
 * 视频框组件属性
 */
export interface VideoBoxProps {
  id?: string;
  label: string;
  position: Position;
  isActive?: boolean;
  scale: number;
  colorClass?: string;
  bgClass?: string;
  visible?: boolean;
  locked?: boolean;
  thumbnail?: string;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent) => void;
}

/**
 * 视频框组件 - 显示单个素材的位置和大小
 * 支持拖拽移动和右下角缩放手柄
 */
const VideoBox: React.FC<VideoBoxProps> = ({
  label,
  position,
  scale,
  onMouseDown,
  onResizeStart,
}) => {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        left: `${position.x * scale}px`,
        top: `${position.y * scale}px`,
        width: `${position.width * scale}px`,
        height: `${position.height * scale}px`,
      }}
      className="video-selection-box absolute border border-[rgba(34,34,34,0.26)] bg-white/92 cursor-move flex items-center justify-center group z-10 transition-all duration-200 ease-out hover:border-[rgba(34,34,34,0.42)] hover:shadow-[0_10px_28px_rgba(34,34,34,0.10)]"
    >
      {/* 中心内容 - 图标和标签 */}
      <div className="pointer-events-none flex flex-col items-center gap-2">
        <Move className="w-7 h-7 text-[#FF385C]/80 drop-shadow-sm" />
        <div className="flex flex-col items-center">
          <span className="video-selection-label text-[10px] font-semibold text-[#222222] uppercase tracking-widest bg-white px-2 py-0.5 rounded-full border border-[#E7E5DF] shadow-[0_6px_14px_rgba(34,34,34,0.06)]">
            {label}
          </span>
          <span className="video-selection-size text-[10px] font-mono text-[#6B6B6B] mt-1 bg-white px-1.5 rounded-full border border-[#E7E5DF] shadow-[0_6px_14px_rgba(34,34,34,0.05)]">
            {Math.round(position.width)} x {Math.round(position.height)}
          </span>
        </div>
      </div>

      {/* 缩放手柄 - 右下角 */}
      <div
        onMouseDown={onResizeStart}
        className="absolute -bottom-4 -right-4 w-10 h-10 cursor-nwse-resize flex items-center justify-center z-30"
        title="拉动调节大小"
      >
        <div className="video-selection-handle w-5 h-5 rounded-full border border-white shadow-[0_4px_12px_rgba(255,56,92,0.28)] flex items-center justify-center hover:scale-105 transition-transform bg-[#FF385C]">
          <Maximize2 className="w-3 h-3 text-white" />
        </div>
      </div>

      {/* 辅助网格 - 九宫格 */}
      <div className="video-selection-grid absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-100">
        <div className="border-r border-b border-[rgba(34,34,34,0.07)]"></div>
        <div className="border-r border-b border-[rgba(34,34,34,0.07)]"></div>
        <div className="border-b border-[rgba(34,34,34,0.07)]"></div>
        <div className="border-r border-b border-[rgba(34,34,34,0.07)]"></div>
        <div className="border-r border-b border-[rgba(34,34,34,0.07)]"></div>
        <div className="border-b border-[rgba(34,34,34,0.07)]"></div>
        <div className="border-r border-[rgba(34,34,34,0.07)]"></div>
        <div className="border-r border-[rgba(34,34,34,0.07)]"></div>
        <div></div>
      </div>
    </div>
  );
};

export default VideoBox;
