/**
 * 地区设置页面
 * 左侧：树形层级列表，右侧：文化档案编辑
 */

import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Search, ChevronRight, ChevronDown, Lock } from 'lucide-react';
import type { Region, RegionTreeNode } from '@shared/types/aside';
import { RegionModal } from './RegionModal';

/**
 * 将平铺地区列表转为树形结构
 */
function buildRegionTree(regions: Region[]): RegionTreeNode[] {
  const map = new Map<string, RegionTreeNode>();
  const roots: RegionTreeNode[] = [];

  for (const r of regions) {
    map.set(r.id, { ...r, children: [] });
  }

  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // 子节点按 sortOrder 排序
  const sortChildren = (nodes: RegionTreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    nodes.forEach((n) => sortChildren(n.children));
  };
  sortChildren(roots);

  return roots;
}

/**
 * 地区设置主页面组件
 */
export function RegionSettingsPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [tree, setTree] = useState<RegionTreeNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [profileDraft, setProfileDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // 当前选中的地区对象
  const selectedRegion = regions.find((r) => r.id === selectedId) ?? null;

  // 加载地区列表
  const loadRegions = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await window.api.regionGetAll();
      if (result.success && result.regions) {
        setRegions(result.regions);
        setTree(buildRegionTree(result.regions));
        // 默认展开一级节点
        const level1Ids = new Set<string>(
          result.regions.filter((r: Region) => r.level === 1).map((r: Region) => r.id)
        );
        setExpandedIds(level1Ids);
      }
    } catch (err) {
      console.error('[RegionSettingsPage] 加载地区失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRegions();
  }, [loadRegions]);

  // 选中地区时同步文化档案草稿
  useEffect(() => {
    setProfileDraft(selectedRegion?.culturalProfile ?? '');
  }, [selectedId, selectedRegion?.culturalProfile]);

  // 展开/折叠节点
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 保存文化档案
  const handleSaveProfile = async () => {
    if (!selectedId) return;
    try {
      setIsSaving(true);
      await window.api.regionUpdate(selectedId, { culturalProfile: profileDraft });
      setRegions((prev) =>
        prev.map((r) => (r.id === selectedId ? { ...r, culturalProfile: profileDraft } : r)),
      );
    } catch (err) {
      console.error('[RegionSettingsPage] 保存文化档案失败:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // 删除地区
  const handleDelete = async (region: Region) => {
    if (region.isPreset) return;
    try {
      await window.api.regionDelete(region.id);
      if (selectedId === region.id) setSelectedId(null);
      await loadRegions();
    } catch (err) {
      console.error('[RegionSettingsPage] 删除地区失败:', err);
    }
  };

  // 保存地区（新增或编辑）
  const handleModalSave = async (data: { name: string; parentId: string | null; emoji: string }) => {
    if (editingRegion) {
      await window.api.regionUpdate(editingRegion.id, data);
    } else {
      await window.api.regionAdd(data);
    }
    await loadRegions();
  };

  // 搜索过滤
  const filteredRegions = searchQuery.trim()
    ? regions.filter((r) => r.name.includes(searchQuery.trim()))
    : null;

  /**
   * 递归渲染树节点
   */
  const renderNode = (node: RegionTreeNode, depth = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedId === node.id;

    return (
      <div key={node.id}>
        <div
          className={`
            flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer group transition-colors
            ${isSelected ? 'bg-violet-600/20 text-violet-300' : 'hover:bg-slate-800 text-slate-300'}
          `}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => setSelectedId(node.id)}
        >
          {/* 展开/折叠按钮 */}
          <button
            className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-slate-300 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) toggleExpand(node.id);
            }}
          >
            {hasChildren ? (
              isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
            ) : null}
          </button>

          {/* Emoji + 名称 */}
          <span className="text-base leading-none">{node.emoji}</span>
          <span className="flex-1 text-sm truncate ml-1">{node.name}</span>

          {/* 预置锁标记 */}
          {node.isPreset && (
            <Lock className="w-3 h-3 text-slate-600 flex-shrink-0 opacity-0 group-hover:opacity-100" />
          )}

          {/* 操作按钮 */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingRegion(node);
                setIsModalOpen(true);
              }}
              className="p-1 hover:text-slate-100 text-slate-500 rounded"
              title="编辑"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(node);
              }}
              disabled={node.isPreset}
              className={`p-1 rounded ${node.isPreset ? 'text-slate-700 cursor-not-allowed' : 'hover:text-red-400 text-slate-500'}`}
              title={node.isPreset ? '预置地区不可删除' : '删除'}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* 子节点 */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex bg-black text-slate-100">
      {/* 左侧：树形列表 */}
      <div className="w-72 flex-shrink-0 border-r border-slate-800 flex flex-col">
        {/* 搜索 + 新增 */}
        <div className="p-3 space-y-2 border-b border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索地区..."
              className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
          </div>
          <button
            onClick={() => {
              setEditingRegion(null);
              setIsModalOpen(true);
            }}
            className="w-full flex items-center justify-center gap-2 py-2 bg-violet-600/20 text-violet-400 border border-violet-600/30 rounded-lg hover:bg-violet-600/30 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            添加地区
          </button>
        </div>

        {/* 树形列表 */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading ? (
            <div className="text-center text-slate-500 text-sm py-8">加载中...</div>
          ) : filteredRegions ? (
            // 搜索结果：平铺展示
            filteredRegions.map((r) => (
              <div
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                  selectedId === r.id ? 'bg-violet-600/20 text-violet-300' : 'hover:bg-slate-800 text-slate-300'
                }`}
              >
                <span>{r.emoji}</span>
                <span className="flex-1 truncate">{r.name}</span>
                <span className="text-xs text-slate-600">Lv{r.level}</span>
              </div>
            ))
          ) : (
            tree.map((node) => renderNode(node))
          )}
        </div>
      </div>

      {/* 右侧：文化档案编辑 */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedRegion ? (
          <>
            {/* 地区信息头 */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedRegion.emoji}</span>
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">{selectedRegion.name}</h2>
                  <p className="text-xs text-slate-500">
                    {'一级 / 二级 / 三级'.split(' / ')[selectedRegion.level - 1]}地区
                    {selectedRegion.isPreset && (
                      <span className="ml-2 text-slate-600">· 预置</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={isSaving || profileDraft === (selectedRegion.culturalProfile ?? '')}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors disabled:opacity-40 text-sm"
              >
                {isSaving ? '保存中...' : '保存档案'}
              </button>
            </div>

            {/* 文化档案编辑器 */}
            <div className="flex-1 p-6 flex flex-col gap-3 min-h-0">
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-400">文化档案（Markdown）</label>
                <span className={`text-xs ${profileDraft.length > 800 ? 'text-red-400' : 'text-slate-600'}`}>
                  {profileDraft.length} / 800
                </span>
              </div>
              <textarea
                value={profileDraft}
                onChange={(e) => setProfileDraft(e.target.value)}
                className="flex-1 w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 font-mono resize-none focus:outline-none focus:border-violet-600 leading-relaxed"
                placeholder={`## 语言风格\n- ...\n\n## 受众特征\n- ...\n\n## 文化共鸣点\n- ...\n\n## 禁忌\n- ...`}
                spellCheck={false}
              />
              <p className="text-xs text-slate-600">
                文化档案将在生成剧本时注入到 AI 提示词中，帮助生成符合地区特色的内容
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-600">
            <div className="text-center">
              <div className="text-5xl mb-4">🗺️</div>
              <p className="text-sm">从左侧选择一个地区</p>
              <p className="text-xs mt-1">查看和编辑文化档案</p>
            </div>
          </div>
        )}
      </div>

      {/* 添加/编辑弹窗 */}
      <RegionModal
        isOpen={isModalOpen}
        editingRegion={editingRegion}
        allRegions={regions}
        onClose={() => setIsModalOpen(false)}
        onSave={handleModalSave}
      />
    </div>
  );
}
