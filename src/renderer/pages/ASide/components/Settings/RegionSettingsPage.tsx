/**
 * 地区设置页面
 * 左侧：树形层级列表；右侧：文化档案编辑
 */

import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Search, ChevronRight, ChevronDown, Lock, FileText } from 'lucide-react';
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

  const sortChildren = (nodes: RegionTreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    nodes.forEach(n => sortChildren(n.children));
  };
  sortChildren(roots);

  return roots;
}

/** 层级标签样式 */
const LEVEL_STYLES: Record<number, string> = {
  1: 'text-[10px] text-violet-400/70 border border-violet-500/20 bg-violet-500/5',
  2: 'text-[10px] text-slate-500 border border-slate-700/50 bg-slate-800/50',
  3: 'text-[10px] text-slate-600 border border-slate-800 bg-slate-900/50',
};

const LEVEL_NAMES: Record<number, string> = { 1: 'L1', 2: 'L2', 3: 'L3' };

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

  const selectedRegion = regions.find(r => r.id === selectedId) ?? null;

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
          result.regions.filter((r: Region) => r.level === 1).map((r: Region) => r.id),
        );
        setExpandedIds(level1Ids);
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
    if (region.isPreset) return;
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

  // 搜索过滤
  const filteredRegions = searchQuery.trim()
    ? regions.filter(r => r.name.includes(searchQuery.trim()))
    : null;

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
            group relative flex items-center gap-2 py-1.5 pr-2 cursor-pointer
            transition-colors select-none
            ${isSelected ? 'bg-slate-800/60' : 'hover:bg-slate-900/60'}
          `}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          onClick={() => setSelectedId(node.id)}
        >
          {/* 选中左侧竖线 */}
          {isSelected && (
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-violet-500" />
          )}

          {/* 展开/折叠图标 */}
          <button
            className="w-3.5 h-3.5 flex items-center justify-center text-slate-700 hover:text-slate-500 flex-shrink-0"
            onClick={e => { e.stopPropagation(); if (hasChildren) toggleExpand(node.id); }}
          >
            {hasChildren
              ? isExpanded
                ? <ChevronDown className="w-3 h-3" />
                : <ChevronRight className="w-3 h-3" />
              : <span className="w-3" />
            }
          </button>

          {/* 名称 */}
          <span className={`flex-1 text-sm truncate ${isSelected ? 'text-slate-100' : 'text-slate-400'}`}>
            {node.name}
          </span>

          {/* 层级徽章 */}
          <span className={`px-1.5 py-0.5 rounded font-mono ${LEVEL_STYLES[node.level] ?? LEVEL_STYLES[3]}`}>
            {LEVEL_NAMES[node.level] ?? `L${node.level}`}
          </span>

          {/* 预置锁 */}
          {node.isPreset && (
            <Lock className="w-3 h-3 text-slate-700 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}

          {/* 操作按钮（悬停显示） */}
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={e => { e.stopPropagation(); setEditingRegion(node); setIsModalOpen(true); }}
              className="p-1 rounded hover:bg-slate-700 text-slate-600 hover:text-slate-300 transition-colors"
              title="编辑"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); handleDelete(node); }}
              disabled={node.isPreset}
              className={`p-1 rounded transition-colors ${
                node.isPreset
                  ? 'text-slate-800 cursor-not-allowed'
                  : 'text-slate-600 hover:bg-slate-700 hover:text-red-400'
              }`}
              title={node.isPreset ? '预置地区不可删除' : '删除'}
            >
              <Trash2 className="w-3 h-3" />
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
      <div className="w-64 flex-shrink-0 border-r border-slate-900 flex flex-col">

        {/* 工具栏 */}
        <div className="p-3 border-b border-slate-900 space-y-2">
          {/* 搜索 */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-700" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索地区…"
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-300 placeholder-slate-700 focus:outline-none focus:border-slate-700 transition-colors"
            />
          </div>

          {/* 添加按钮 */}
          <button
            onClick={() => { setEditingRegion(null); setIsModalOpen(true); }}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-slate-800 rounded-lg text-xs text-slate-500 hover:border-slate-700 hover:text-slate-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            添加地区
          </button>
        </div>

        {/* 树形内容 */}
        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="text-center text-slate-700 text-xs py-10 tracking-wide">加载中…</div>
          ) : filteredRegions ? (
            // 搜索结果平铺
            <div className="px-2 space-y-0.5">
              {filteredRegions.map(r => (
                <div
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors
                    ${selectedId === r.id ? 'bg-slate-800 text-slate-100' : 'text-slate-500 hover:bg-slate-900 hover:text-slate-300'}
                  `}
                >
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className={`text-[10px] font-mono px-1 rounded ${LEVEL_STYLES[r.level] ?? LEVEL_STYLES[3]}`}>
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
            <div className="px-7 py-5 border-b border-slate-900">
              <div className="flex items-start justify-between">
                <div>
                  {/* 面包屑 */}
                  <p className="text-[11px] text-slate-700 tracking-widest uppercase mb-1.5">
                    {buildBreadcrumb(selectedRegion).join('  /  ')}
                  </p>
                  {/* 地区名 */}
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-100">
                    {selectedRegion.name}
                  </h2>
                  {selectedRegion.isPreset && (
                    <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-slate-700 border border-slate-800 rounded px-1.5 py-0.5">
                      <Lock className="w-2.5 h-2.5" />
                      预置
                    </span>
                  )}
                </div>

                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving || !isDirty}
                  className={`
                    px-4 py-2 rounded-lg text-sm font-medium transition-all
                    ${isDirty && !isSaving
                      ? 'bg-violet-600 hover:bg-violet-500 text-white'
                      : 'bg-slate-900 text-slate-700 cursor-not-allowed border border-slate-800'
                    }
                  `}
                >
                  {isSaving ? '保存中…' : '保存档案'}
                </button>
              </div>
            </div>

            {/* 文化档案编辑区 */}
            <div className="flex-1 flex flex-col min-h-0 px-7 py-5 gap-3">
              {/* 标签 + 字符计数 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <FileText className="w-3.5 h-3.5" />
                  <span>文化档案</span>
                  <span className="text-slate-800">·</span>
                  <span className="font-mono text-slate-700">Markdown</span>
                </div>
                <span className={`text-xs font-mono tabular-nums ${charCount > charLimit ? 'text-red-500' : 'text-slate-700'}`}>
                  {charCount} / {charLimit}
                </span>
              </div>

              {/* 字符进度条 */}
              <div className="h-px bg-slate-900 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${charCount > charLimit ? 'bg-red-500/60' : 'bg-violet-600/40'}`}
                  style={{ width: `${Math.min((charCount / charLimit) * 100, 100)}%` }}
                />
              </div>

              {/* Textarea */}
              <textarea
                value={profileDraft}
                onChange={e => setProfileDraft(e.target.value)}
                className="
                  flex-1 w-full bg-slate-950/60 border border-slate-900 rounded-xl
                  p-5 text-sm text-slate-300 font-mono resize-none
                  focus:outline-none focus:border-slate-800
                  leading-7 tracking-wide
                  placeholder-slate-800
                "
                placeholder={`## 语言风格\n- ...\n\n## 受众特征\n- ...\n\n## 文化共鸣点\n- ...\n\n## 禁忌\n- ...`}
                spellCheck={false}
              />

              <p className="text-xs text-slate-800 leading-relaxed">
                文化档案将在剧本生成时注入到 AI 提示词，帮助生成符合地区特色的内容
              </p>
            </div>
          </>
        ) : (
          /* 未选中状态 */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full border border-slate-900 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-5 h-5 text-slate-700" />
              </div>
              <p className="text-sm text-slate-700">从左侧选择一个地区</p>
              <p className="text-xs text-slate-800">查看和编辑文化档案</p>
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
