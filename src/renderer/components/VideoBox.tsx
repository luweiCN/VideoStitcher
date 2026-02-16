import React from 'react';
import { Move, Maximize2 } from 'lucide-react';
import { Position } from '../types';

/**
 * 视频框组件属性
 */
export interface VideoBoxProps {
  label: string;
  position: Position;
  scale: number;
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
      className="absolute border-2 border-fuchsia-400 bg-fuchsia-500/20 cursor-move flex items-center justify-center group shadow-2xl z-10"
    >
      {/* 中心内容 - 图标和标签 */}
      <div className="pointer-events-none flex flex-col items-center gap-2">
        <Move className="w-8 h-8 text-indigo-400" />
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold text-white/90 uppercase tracking-widest bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm">
            {label}
          </span>
          <span className="text-[10px] font-mono text-indigo-300 mt-1 bg-slate-900/80 px-1.5 rounded">
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
        <div className="w-7 h-7 rounded-full border-2 border-white shadow-xl flex items-center justify-center hover:scale-125 transition-transform bg-fuchsia-500">
          <Maximize2 className="w-4 h-4 text-white" />
        </div>
      </div>

      {/* 辅助网格 - 九宫格 */}
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
        <div className="border-r border-b border-white/40"></div>
        <div className="border-r border-b border-white/40"></div>
        <div className="border-b border-white/40"></div>
        <div className="border-r border-b border-white/40"></div>
        <div className="border-r border-b border-white/40"></div>
        <div className="border-b border-white/40"></div>
        <div className="border-r border-white/40"></div>
        <div className="border-r border-white/40"></div>
        <div></div>
      </div>
    </div>
  );
};

export default VideoBox;
