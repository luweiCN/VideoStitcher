/**
 * 地区编辑弹窗
 * 用于添加或编辑地区（名称、上级、emoji）
 */

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Region } from '@shared/types/aside';

interface RegionModalProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 编辑模式的初始数据（undefined 为新建模式） */
  editingRegion?: Region | null;
  /** 所有地区列表（用于选择上级） */
  allRegions: Region[];
  /** 关闭弹窗 */
  onClose: () => void;
  /** 保存回调 */
  onSave: (data: {
    name: string;
    parentId: string | null;
    emoji: string;
  }) => Promise<void>;
}

/**
 * 地区弹窗组件
 */
export function RegionModal({
  isOpen,
  editingRegion,
  allRegions,
  onClose,
  onSave,
}: RegionModalProps) {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [emoji, setEmoji] = useState('📍');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!editingRegion;

  // 初始化表单
  useEffect(() => {
    if (isOpen) {
      if (editingRegion) {
        setName(editingRegion.name);
        setParentId(editingRegion.parentId ?? null);
        setEmoji(editingRegion.emoji || '📍');
      } else {
        setName('');
        setParentId(null);
        setEmoji('📍');
      }
      setError('');
    }
  }, [isOpen, editingRegion]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setError('地区名称不能为空');
      return;
    }

    try {
      setIsSaving(true);
      setError('');
      await onSave({ name: name.trim(), parentId, emoji });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 可选的上级地区（不包括自身及其子孙，支持无限级）
  const parentOptions = allRegions.filter(
    (r) => r.id !== editingRegion?.id,
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        {/* 标题 */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-slate-100">
            {isEdit ? '编辑地区' : '添加地区'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 表单 */}
        <div className="p-6 space-y-5">
          {/* Emoji + 名称 */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">地区名称</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                maxLength={4}
                className="w-16 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 text-center text-lg focus:outline-none focus:border-violet-500"
                placeholder="📍"
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                placeholder="输入地区名称"
                autoFocus
              />
            </div>
          </div>

          {/* 上级地区 */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">所属上级（可选）</label>
            <select
              value={parentId ?? ''}
              onChange={(e) => setParentId(e.target.value || null)}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-violet-500"
            >
              <option value="">无（一级地区）</option>
              {parentOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {'　'.repeat(r.level - 1)}{r.emoji} {r.name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-700 text-slate-300 rounded-lg hover:bg-slate-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors disabled:opacity-50"
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
