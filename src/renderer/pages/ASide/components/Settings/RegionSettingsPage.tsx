/**
 * 地区设置页面
 * 左侧：树形层级列表；右侧：文化档案编辑
 */

import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Search, X, ChevronRight, ChevronDown, RotateCcw, MapPin } from 'lucide-react';
import type { Region, RegionTreeNode } from '@shared/types/aside';
import { RegionModal } from './RegionModal';
import { useConfirm } from '@renderer/hooks/useConfirm';
import { useRegionSearch } from '../../hooks/useRegionSearch';

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

  const sortChildren = (nodes: RegionTreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    nodes.forEach(n => sortChildren(n.children));
  };
  sortChildren(roots);

  return roots;
}

/** 层级标签样式 */
const LEVEL_STYLES: Record<number, string> = {
  1: 'text-xs text-violet-400/80 border border-violet-500/25 bg-violet-500/8',
  2: 'text-xs text-slate-400/70 border border-slate-700/60 bg-slate-800/60',
  3: 'text-xs text-slate-500/70 border border-slate-800/80 bg-slate-900/60',
};

const LEVEL_NAMES: Record<number, string> = { 1: 'L1', 2: 'L2', 3: 'L3' };

/**
 * 地区设置主页面组件
 */
export function RegionSettingsPage() {
  const confirm = useConfirm();
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
  const [isResetting, setIsResetting] = useState(false);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);

  const selectedRegion = regions.find(r => r.id === selectedId) ?? null;

  // 加载地区列表
  const loadRegions = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await window.api.regionGetAll();
      if (result.success && result.regions) {
        setRegions(result.regions);
        setTree(buildRegionTree(result.regions));
        // 默认展开 L1 和 L2 节点
        const level12Ids = new Set<string>(
          result.regions
            .filter((r: Region) => r.level <= 2)
            .map((r: Region) => r.id),
        );
        setExpandedIds(level12Ids);
      }
    } catch (err) {
      console.error('[RegionSettingsPage] 加载地区失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadRegions(); }, [loadRegions]);

  // 选中地区时同步文化档案草稿
  useEffect(() => {
    setProfileDraft(selectedRegion?.culturalProfile ?? '');
  }, [selectedId, selectedRegion?.culturalProfile]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // 保存文化档案
  const handleSaveProfile = async () => {
    if (!selectedId) return;
    try {
      setIsSaving(true);
      await window.api.regionUpdate(selectedId, { culturalProfile: profileDraft });
      setRegions(prev =>
        prev.map(r => (r.id === selectedId ? { ...r, culturalProfile: profileDraft } : r)),
      );
    } catch (err) {
      console.error('[RegionSettingsPage] 保存文化档案失败:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (region: Region) => {
    const ok = await confirm({
      title: '删除地区',
      message: `确定删除「${region.name}」？其子级地区将失去父级关联，此操作不可撤销。`,
      confirmText: '确认删除',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await window.api.regionDelete(region.id);
      if (selectedId === region.id) setSelectedId(null);
      await loadRegions();
    } catch (err) {
      console.error('[RegionSettingsPage] 删除地区失败:', err);
    }
  };

  const handleModalSave = async (data: { name: string; parentId: string | null; emoji: string }) => {
    if (editingRegion) {
      await window.api.regionUpdate(editingRegion.id, data);
    } else {
      await window.api.regionAdd(data);
    }
    await loadRegions();
  };

  const handleResetPresets = async () => {
    const ok = await confirm({
      title: '重置预置数据',
      message: '将删除所有预置地区（包括已修改过文化档案的），重新植入最新版本的预置数据。自定义地区不受影响。',
      confirmText: '确认重置',
      variant: 'warning',
    });
    if (!ok) return;
    try {
      setIsResetting(true);
      await window.api.regionResetPresets();
      setSelectedId(null);
      await loadRegions();
    } catch (err) {
      console.error('[RegionSettingsPage] 重置预置数据失败:', err);
    } finally {
      setIsResetting(false);
    }
  };

  // 搜索过滤（支持中文、全拼、首字母模糊匹配）
  const searchResults = useRegionSearch(regions, searchQuery);
  const filteredRegions = searchQuery.trim() ? searchResults : null;

  // 构建选中地区的路径（用于面包屑）
  const buildBreadcrumb = (region: Region): string[] => {
    const path: string[] = [region.name];
    let current = region;
    while (current.parentId) {
      const parent = regions.find(r => r.id === current.parentId);
      if (!parent) break;
      path.unshift(parent.name);
      current = parent;
    }
    return path;
  };

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
            group relative flex items-center gap-2 py-2.5 pr-2 cursor-pointer
            transition-colors select-none
            ${isSelected ? 'bg-slate-800/70' : 'hover:bg-slate-900/50'}
          `}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          onClick={() => setSelectedId(node.id)}
        >
          {/* 选中左侧竖线 */}
          {isSelected && (
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-violet-500" />
          )}

          {/* 展开/折叠图标 */}
          <button
            className="w-4 h-4 flex items-center justify-center text-slate-600 hover:text-slate-400 flex-shrink-0"
            onClick={e => { e.stopPropagation(); if (hasChildren) toggleExpand(node.id); }}
          >
            {hasChildren
              ? isExpanded
                ? <ChevronDown className="w-4 h-4" />
                : <ChevronRight className="w-4 h-4" />
              : <span className="w-4" />
            }
          </button>

          {/* 名称 */}
          <span className={`flex-1 text-[15px] truncate ${isSelected ? 'text-slate-100 font-medium' : 'text-slate-400'}`}>
            {node.name}
          </span>

          {/* 层级徽章 */}
          <span className={`px-1.5 py-0.5 rounded font-mono ${LEVEL_STYLES[node.level] ?? LEVEL_STYLES[3]}`}>
            {LEVEL_NAMES[node.level] ?? `L${node.level}`}
          </span>

          {/* 操作按钮（悬停显示） */}
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={e => {
                e.stopPropagation();
                setEditingRegion(null);
                setDefaultParentId(node.id);
                setIsModalOpen(true);
              }}
              className="p-1 rounded hover:bg-slate-700 text-slate-600 hover:text-violet-400 transition-colors"
              title="添加子级"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); setEditingRegion(node); setDefaultParentId(null); setIsModalOpen(true); }}
              className="p-1 rounded hover:bg-slate-700 text-slate-600 hover:text-slate-300 transition-colors"
              title="编辑"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); handleDelete(node); }}
              className="p-1 rounded transition-colors text-slate-600 hover:bg-slate-700 hover:text-red-400"
              title="删除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 子节点 */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const isDirty = profileDraft !== (selectedRegion?.culturalProfile ?? '');
  const charCount = profileDraft.length;
  const charLimit = 800;

  return (
    <div className="h-full flex bg-[#0a0a0a] text-slate-100">

      {/* ── 左侧：树形列表 ── */}
      <div className="w-72 flex-shrink-0 border-r border-slate-800/60 flex flex-col">

        {/* 左侧顶部 header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
          <span className="text-sm font-semibold text-slate-400 tracking-wider uppercase">地区管理</span>
          <button
            onClick={handleResetPresets}
            disabled={isResetting}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-sm text-red-500/80 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-40"
            title="重置预置数据"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            重置
          </button>
        </div>

        {/* 工具栏 */}
        <div className="px-4 py-3 border-b border-slate-800/60 space-y-2.5">
          {/* 搜索 */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索地区…"
              className="w-full pl-9 pr-8 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-[15px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-600 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 添加按钮 */}
          <button
            onClick={() => { setEditingRegion(null); setDefaultParentId(null); setIsModalOpen(true); }}
            className="w-full flex items-center justify-center gap-2 py-2 border border-slate-800 rounded-lg text-[15px] text-slate-500 hover:border-slate-600 hover:text-slate-300 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加地区
          </button>
        </div>

        {/* 树形内容 */}
        <div className="flex-1 overflow-y-auto py-1.5">
          {isLoading ? (
            <div className="text-center text-slate-600 text-base py-12 tracking-wide">加载中…</div>
          ) : filteredRegions ? (
            // 搜索结果平铺
            <div className="px-2 space-y-0.5">
              {filteredRegions.map(r => (
                <div
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`
                    flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer text-[15px] transition-colors
                    ${selectedId === r.id ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:bg-slate-900/60 hover:text-slate-300'}
                  `}
                >
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className={`px-1.5 py-0.5 rounded font-mono ${LEVEL_STYLES[r.level] ?? LEVEL_STYLES[3]}`}>
                    L{r.level}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            tree.map(node => renderNode(node))
          )}
        </div>
      </div>

      {/* ── 右侧：文化档案编辑 ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedRegion ? (
          <>
            {/* 地区信息头 */}
            <div className="px-10 py-6 border-b border-slate-800/60">
              <div className="flex items-start justify-between">
                <div>
                  {/* 面包屑 */}
                  <p className="text-sm text-slate-600 tracking-widest uppercase mb-2">
                    {buildBreadcrumb(selectedRegion).join('  ›  ')}
                  </p>
                  {/* 地区名 */}
                  <h2 className="text-4xl font-semibold tracking-tight text-slate-100">
                    {selectedRegion.emoji && <span className="mr-2">{selectedRegion.emoji}</span>}
                    {selectedRegion.name}
                  </h2>
                </div>

                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving || !isDirty}
                  className={`
                    px-5 py-2.5 rounded-lg text-base font-medium transition-all
                    ${isDirty && !isSaving
                      ? 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-900/30'
                      : 'bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800'
                    }
                  `}
                >
                  {isSaving ? '保存中…' : '保存档案'}
                </button>
              </div>
            </div>

            {/* 文化档案编辑区 */}
            <div className="flex-1 flex flex-col min-h-0 px-10 py-6 gap-4">
              {/* 标签行 */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-500 tracking-wider uppercase">文化档案</span>
                <span className={`text-sm font-mono tabular-nums ${charCount > charLimit ? 'text-red-400' : 'text-slate-600'}`}>
                  {charCount} / {charLimit}
                </span>
              </div>

              {/* Textarea */}
              <textarea
                value={profileDraft}
                onChange={e => setProfileDraft(e.target.value)}
                className="
                  flex-1 w-full bg-slate-950/40 border border-slate-800/80 rounded-xl
                  px-6 py-5 text-[15px] text-slate-300 font-mono resize-none
                  focus:outline-none focus:border-slate-700
                  leading-7 tracking-wide
                  placeholder-slate-700
                "
                placeholder={`## 语言风格\n- ...\n\n## 受众特征\n- ...\n\n## 文化共鸣点\n- ...\n\n## 禁忌\n- ...`}
                spellCheck={false}
              />

              <p className="text-sm text-slate-500 leading-relaxed">
                文化档案将在剧本生成时注入到 AI 提示词，帮助生成符合地区特色的内容
              </p>
            </div>
          </>
        ) : (
          /* 未选中状态 */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl border border-slate-800 flex items-center justify-center mx-auto mb-5 bg-slate-900/40">
                <MapPin className="w-7 h-7 text-slate-600" />
              </div>
              <p className="text-lg text-slate-500">从左侧选择一个地区</p>
              <p className="text-base text-slate-700">查看和编辑文化档案</p>
            </div>
          </div>
        )}
      </div>

      {/* 添加/编辑弹窗 */}
      <RegionModal
        isOpen={isModalOpen}
        editingRegion={editingRegion}
        defaultParentId={defaultParentId}
        allRegions={regions}
        onClose={() => setIsModalOpen(false)}
        onSave={handleModalSave}
      />
    </div>
  );
}
