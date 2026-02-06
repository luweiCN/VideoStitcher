import React from 'react';
import { Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { LayerId, LayerConfig } from '../types';

/**
 * 图层侧边栏组件属性
 */
export interface LayerSidebarProps {
  layers: LayerConfig[];
  activeLayer: LayerId;
  onLayerSelect: (id: LayerId) => void;
  onLayerVisibilityChange: (id: LayerId, visible: boolean) => void;
  onLayerLockChange?: (id: LayerId, locked: boolean) => void;
}

/**
 * 图层侧边栏组件
 *
 * 功能：
 * - 显示所有素材图层列表
 * - 点击选中图层
 * - 切换图层可见性
 * - 锁定/解锁图层（可选）
 */
const LayerSidebar: React.FC<LayerSidebarProps> = ({
  layers,
  activeLayer,
  onLayerSelect,
  onLayerVisibilityChange,
  onLayerLockChange,
}) => {
  // 按 z-index 排序，确保图层层级正确显示
  const sortedLayers = [...layers].sort((a, b) => a.z_index - b.z_index);

  return (
    <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800">
      <h2 className="text-[11px] font-black text-violet-400 uppercase tracking-widest mb-3 flex items-center gap-2">
        图层
      </h2>
      <div className="space-y-1">
        {sortedLayers.map((layer) => {
          const isActive = activeLayer === layer.id;
          return (
            <div
              key={layer.id}
              onClick={() => !layer.locked && onLayerSelect(layer.id)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg transition-all cursor-pointer
                ${isActive
                  ? `bg-gradient-to-r ${layer.bgClass.replace('/30', '')}/20 border border-${layer.colorClass.split('-')[1]}-500/50`
                  : 'hover:bg-slate-900 border border-transparent'
                }
                ${layer.locked ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {/* 图层颜色指示器 */}
              <div
                className={`w-2 h-2 rounded-full ${isActive ? layer.colorClass : 'bg-slate-600'}`}
              />

              {/* 图层名称 */}
              <span className={`text-[10px] font-bold flex-1 ${isActive ? 'text-white' : 'text-slate-400'}`}>
                {layer.label}
              </span>

              {/* 锁定按钮 */}
              {onLayerLockChange && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLayerLockChange(layer.id, !layer.locked);
                  }}
                  className={`p-1 rounded transition-colors ${
                    layer.locked ? 'text-amber-500 hover:text-amber-400' : 'text-slate-600 hover:text-slate-400'
                  }`}
                  title={layer.locked ? '解锁图层' : '锁定图层'}
                >
                  {layer.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                </button>
              )}

              {/* 可见性切换按钮 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onLayerVisibilityChange(layer.id, !layer.visible);
                }}
                className={`p-1 rounded transition-colors ${
                  layer.visible ? 'text-emerald-500 hover:text-emerald-400' : 'text-slate-600 hover:text-slate-400'
                }`}
                title={layer.visible ? '隐藏图层' : '显示图层'}
              >
                {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>
            </div>
          );
        })}
      </div>

      {/* 图层提示 */}
      <div className="mt-3 p-2 bg-slate-900/50 rounded-lg">
        <p className="text-[9px] text-slate-500 text-center">
          点击选中图层，在右侧画布中拖拽调整
        </p>
      </div>
    </div>
  );
};

export default LayerSidebar;
