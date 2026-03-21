/**
 * 区域选择器（Step 2）
 * 复用 StepLayout，全量展开层级地区 + 右侧 1/3 宽文化档案预览
 * 树形渲染支持无限级地区
 */

import { useState, useEffect, useMemo } from 'react';
import { Search, X, Clock, MapPin } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useASideStore } from '@renderer/stores/asideStore';
import type { Region } from '@shared/types/aside';
import { StepLayout } from '../StepLayout';
import { getRecentRegions, saveRecentRegion } from './RecentRegions';
import { useRegionSearch } from '../../hooks/useRegionSearch';

// ─── 树节点类型 ────────────────────────────────────────────────────────────

type RegionNode = Region & { children: RegionNode[] };

// ─── 主组件 ───────────────────────────────────────────────────────────────

export function RegionSelector() {
  const { currentProject, selectRegion, goToNextStep, goToPrevStep } = useASideStore();
  const [regions, setRegions] = useState<Region[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  // 进入页面时冻结最近选择列表，只有点击「下一步」后才刷新
  const [recentIds] = useState<string[]>(() => getRecentRegions());

  useEffect(() => {
    (async () => {
      try {
        const result = await window.api.regionGetAll();
        if (result.success && result.regions) {
          setRegions(result.regions.filter((r: Region) => r.isActive));
        }
      } catch (err) {
        console.error('[RegionSelector] 加载地区失败:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // ── 衍生数据 ──────────────────────────────────────────────────────────

  // 构建递归树结构（支持无限级）
  const regionTree = useMemo<RegionNode[]>(() => {
    const map = new Map<string, RegionNode>();
    const roots: RegionNode[] = [];

    regions.forEach(r => map.set(r.id, { ...r, children: [] }));
    regions.forEach(r => {
      const node = map.get(r.id)!;
      if (r.parentId && map.has(r.parentId)) {
        map.get(r.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    const sort = (nodes: RegionNode[]) => {
      nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      nodes.forEach(n => sort(n.children));
    };
    sort(roots);

    return roots;
  }, [regions]);

  // 判断节点子树中是否存在可选地区（有文化档案）
  const hasAnyProfile = (node: RegionNode): boolean => {
    if (node.culturalProfile?.trim()) return true;
    return node.children.some(hasAnyProfile);
  };

  // 有文化档案的地区才可选（用于搜索和最近选择）
  const selectableRegions = useMemo(
    () => regions.filter(r => !!r.culturalProfile?.trim()),
    [regions],
  );
  const searchResults = useRegionSearch(selectableRegions, searchQuery);

  const recentRegions = useMemo(
    () => recentIds.map(id => selectableRegions.find(r => r.id === id)).filter(Boolean) as Region[],
    [recentIds, selectableRegions],
  );

  const selectedRegion = useMemo(
    () => regions.find(r => r.id === selectedRegionId) ?? null,
    [regions, selectedRegionId],
  );

  // ── 事件处理 ──────────────────────────────────────────────────────────

  const handleSelect = (region: Region) => {
    setSelectedRegionId(region.id);
    selectRegion(region.id);
  };

  const handleNext = () => {
    if (!selectedRegionId) return;
    saveRecentRegion(selectedRegionId);
    goToNextStep();
  };

  // ── 递归渲染树（支持无限级） ──────────────────────────────────────────
  // 规则：叶子节点有档案 → 胶囊；内节点 → 小标题 + 子级；无可见内容 → 跳过

  const renderGroup = (nodes: RegionNode[]): React.ReactNode => {
    const leaves = nodes.filter(n => n.children.length === 0 && !!n.culturalProfile?.trim());
    const groups = nodes.filter(n => n.children.length > 0 && hasAnyProfile(n));

    if (leaves.length === 0 && groups.length === 0) return null;

    return (
      <>
        {leaves.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {leaves.map(n => (
              <RegionPill key={n.id} region={n} isSelected={selectedRegionId === n.id} onSelect={handleSelect} />
            ))}
          </div>
        )}
        {groups.map(n => (
          <div key={n.id} className="mb-4">
            <p className="text-xs text-slate-600 mb-2">
              {n.emoji ? `${n.emoji} ${n.name}` : n.name}
            </p>
            {renderGroup(n.children)}
          </div>
        ))}
      </>
    );
  };

  // ── 搜索栏（放在 StepLayout header 右侧） ────────────────────────────

  const searchBar = (
    <div className="relative w-56">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
      <input
        autoFocus
        type="text"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="搜索地区（支持拼音）"
        className="w-full pl-9 pr-8 py-2 bg-slate-900/60 border border-slate-800 rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-600 transition-colors"
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
  );

  if (!currentProject) {
    return (
      <div className="h-full flex items-center justify-center bg-black text-slate-600">
        请先选择一个项目
      </div>
    );
  }

  return (
    <StepLayout
      title="选择目标地区"
      stepNumber={2}
      totalSteps={4}
      scrollable={false}
      rightContent={searchBar}
      onPrev={goToPrevStep}
      onNext={selectedRegionId ? handleNext : undefined}
    >
      <div className="h-full flex min-h-0">

        {/* ── 左侧主区域：地区浏览 ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto px-8 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-slate-600">加载中…</div>
          ) : searchQuery.trim() ? (
            /* ── 搜索结果平铺 ── */
            searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-600">
                <MapPin className="w-6 h-6 mb-2 opacity-30" />
                <p>没有找到匹配的地区</p>
                <p className="text-sm mt-1 text-slate-700">尝试拼音或其他关键词</p>
              </div>
            ) : (
              <div>
                <p className="text-xs text-slate-700 uppercase tracking-widest mb-4">
                  {searchResults.length} 个结果
                </p>
                <div className="flex flex-wrap gap-2">
                  {searchResults.map(r => (
                    <RegionPill key={r.id} region={r} isSelected={selectedRegionId === r.id} onSelect={handleSelect} />
                  ))}
                </div>
              </div>
            )
          ) : (
            /* ── 层级全展开（递归，支持无限级） ── */
            <>
              {/* 最近选择（冻结） */}
              {recentRegions.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-3.5 h-3.5 text-slate-600" />
                    <span className="text-xs text-slate-600 uppercase tracking-widest font-medium">最近选择</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentRegions.map(r => (
                      <RegionPill key={r.id} region={r} isSelected={selectedRegionId === r.id} onSelect={handleSelect} />
                    ))}
                  </div>
                </div>
              )}

              {/* 根节点：作为分区标题，子节点递归渲染 */}
              {regionTree.map(root => {
                if (!hasAnyProfile(root)) return null;
                return (
                  <div key={root.id} className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-xs text-slate-600 uppercase tracking-widest font-medium shrink-0">
                        {root.emoji ? `${root.emoji} ${root.name}` : root.name}
                      </span>
                      <div className="flex-1 h-px bg-slate-900" />
                    </div>
                    {renderGroup(root.children)}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* ── 右侧：文化档案预览（1/3 宽） ── */}
        <div className="w-1/3 flex-shrink-0 border-l border-slate-800/60 flex flex-col">

          {/* 可滚动内容区 */}
          <div className="flex-1 overflow-y-auto">
            {selectedRegion ? (
              <div className="p-6">
                {/* 地区标题 */}
                <div className="mb-5 pb-5 border-b border-slate-800/60">
                  <p className="text-xs text-slate-600 uppercase tracking-widest mb-1.5">目标地区</p>
                  <p className="text-xl font-semibold text-slate-100">
                    {selectedRegion.emoji && <span className="mr-2">{selectedRegion.emoji}</span>}
                    {selectedRegion.name}
                  </p>
                </div>

                {/* 文化档案 */}
                {selectedRegion.culturalProfile?.trim() ? (
                  <>
                    <p className="text-xs text-slate-600 uppercase tracking-widest mb-4">文化档案</p>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h2: ({ children }) => (
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-6 mb-2.5 first:mt-0">{children}</p>
                        ),
                        h3: ({ children }) => (
                          <p className="text-sm font-medium text-slate-400 mt-4 mb-2">{children}</p>
                        ),
                        ul: ({ children }) => (
                          <ul className="space-y-1.5 mb-4">{children}</ul>
                        ),
                        li: ({ children }) => (
                          <li className="flex items-start gap-2 text-base text-slate-400 leading-relaxed">
                            <span className="mt-2 w-1 h-1 rounded-full bg-slate-600 flex-shrink-0" />
                            <span>{children}</span>
                          </li>
                        ),
                        p: ({ children }) => (
                          <p className="text-base text-slate-400 leading-relaxed mb-3">{children}</p>
                        ),
                        strong: ({ children }) => (
                          <strong className="text-slate-300 font-medium">{children}</strong>
                        ),
                      }}
                    >
                      {selectedRegion.culturalProfile}
                    </ReactMarkdown>
                  </>
                ) : (
                  <p className="text-sm text-slate-700">暂无文化档案</p>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-6">
                <p className="text-sm text-slate-700 text-center leading-relaxed">
                  选择地区后<br />在此查看文化档案
                </p>
              </div>
            )}
          </div>

          {/* 底部提示语（固定） */}
          <div className="flex-shrink-0 px-5 py-3 border-t border-slate-800/40">
            <p className="text-sm text-slate-500 leading-relaxed">
              选中地区的文化档案将在生成剧本时注入 AI 提示词
            </p>
          </div>

        </div>

      </div>
    </StepLayout>
  );
}

// ─── 地区胶囊 ─────────────────────────────────────────────────────────────

function RegionPill({
  region,
  isSelected,
  onSelect,
}: {
  region: Region;
  isSelected: boolean;
  onSelect: (r: Region) => void;
}) {
  return (
    <button
      onClick={() => onSelect(region)}
      className={`
        px-4 py-2 rounded-full text-base border transition-all duration-150
        ${isSelected
          ? 'border-violet-500 bg-violet-500/10 text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.15)]'
          : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:bg-slate-900/80 hover:text-slate-200'
        }
      `}
    >
      {region.emoji && <span className="mr-1">{region.emoji}</span>}
      {region.name}
    </button>
  );
}
