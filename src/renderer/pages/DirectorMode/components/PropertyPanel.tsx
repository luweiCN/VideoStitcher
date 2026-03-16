/**
 * 属性面板 - 编辑选中项属性
 */

import React, { useState } from 'react';
import { X, Edit2, Save, User, Film } from 'lucide-react';
import type { Character, Scene, SelectedItem } from '../types';

interface PropertyPanelProps {
  selectedItem: SelectedItem | null;
  characters: Character[];
  scenes: Scene[];
  onUpdate: (updates: any) => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedItem,
  characters,
  scenes,
  onUpdate,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  // 获取选中项数据
  const getItemData = () => {
    if (!selectedItem) return null;

    if (selectedItem.type === 'character') {
      return characters.find(c => c.id === selectedItem.id);
    } else if (selectedItem.type === 'scene') {
      return scenes.find(s => s.id === selectedItem.id);
    }

    return null;
  };

  const itemData = getItemData();

  // 未选中状态
  if (!selectedItem || !itemData) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <div className="w-16 h-16 bg-slate-800/50 rounded-2xl flex items-center justify-center mb-4">
          <Edit2 className="w-8 h-8 text-slate-600" />
        </div>
        <h3 className="text-white font-medium mb-2">未选中项目</h3>
        <p className="text-sm text-slate-500 text-center">
          点击画布中的角色或分镜，在此编辑属性
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 标题栏 */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedItem.type === 'character' ? (
              <User className="w-5 h-5 text-violet-400" />
            ) : (
              <Film className="w-5 h-5 text-blue-400" />
            )}
            <h3 className="text-lg font-bold text-white">
              {selectedItem.type === 'character' ? '角色属性' : '场景属性'}
            </h3>
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`p-2 rounded-lg transition-colors ${
              isEditing
                ? 'bg-violet-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {isEditing ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 属性编辑区 */}
      <div className="flex-1 overflow-auto p-4">
        {/* 角色属性 */}
        {selectedItem.type === 'character' && (
          <div className="space-y-4">
            {/* 角色名称 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                角色名称
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={(itemData as Character).name}
                  onChange={(e) => onUpdate({ name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:outline-none focus:border-violet-500"
                />
              ) : (
                <p className="text-white">{(itemData as Character).name}</p>
              )}
            </div>

            {/* 角色描述 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                角色描述
              </label>
              {isEditing ? (
                <textarea
                  value={(itemData as Character).description}
                  onChange={(e) => onUpdate({ description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:outline-none focus:border-violet-500 resize-none"
                />
              ) : (
                <p className="text-slate-300 text-sm">
                  {(itemData as Character).description}
                </p>
              )}
            </div>

            {/* 角色特征 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                角色特征
              </label>
              <div className="flex flex-wrap gap-2">
                {(itemData as Character).traits.map((trait, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-violet-500/10 text-violet-300 text-sm rounded-lg border border-violet-500/30"
                  >
                    {trait}
                  </span>
                ))}
              </div>
            </div>

            {/* 声音风格 */}
            {(itemData as Character).voiceStyle && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  声音风格
                </label>
                <p className="text-slate-300 text-sm">
                  {(itemData as Character).voiceStyle}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 场景属性 */}
        {selectedItem.type === 'scene' && (
          <div className="space-y-4">
            {/* 场景编号 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                场景编号
              </label>
              <p className="text-white">场景 {(itemData as Scene).sequence}</p>
            </div>

            {/* 场景描述 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                场景描述
              </label>
              {isEditing ? (
                <textarea
                  value={(itemData as Scene).description}
                  onChange={(e) => onUpdate({ description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:outline-none focus:border-violet-500 resize-none"
                />
              ) : (
                <p className="text-slate-300 text-sm">
                  {(itemData as Scene).description}
                </p>
              )}
            </div>

            {/* 时长 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                时长 (秒)
              </label>
              {isEditing ? (
                <input
                  type="number"
                  value={(itemData as Scene).duration}
                  onChange={(e) => onUpdate({ duration: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:outline-none focus:border-violet-500"
                />
              ) : (
                <p className="text-white">{(itemData as Scene).duration} 秒</p>
              )}
            </div>

            {/* 转场效果 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                转场效果
              </label>
              {isEditing ? (
                <select
                  value={(itemData as Scene).transition}
                  onChange={(e) => onUpdate({ transition: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:outline-none focus:border-violet-500"
                >
                  <option value="fade">淡入淡出</option>
                  <option value="slide">滑动</option>
                  <option value="zoom">缩放</option>
                  <option value="cut">直切</option>
                </select>
              ) : (
                <p className="text-slate-300 text-sm">
                  {(itemData as Scene).transition}
                </p>
              )}
            </div>

            {/* 参与角色 */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                参与角色
              </label>
              <p className="text-slate-300 text-sm">
                {(itemData as Scene).characters.length} 个角色
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
