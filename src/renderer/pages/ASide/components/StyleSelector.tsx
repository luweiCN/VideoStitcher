/**
 * 风格选择卡片组件
 */

import React from 'react';
import { Check } from 'lucide-react';
import type { StyleTemplate } from '../../pages/ASide/types';

interface StyleSelectorProps {
  styles: StyleTemplate[];
  selectedStyle: StyleTemplate | null;
  onSelect: (style: StyleTemplate) => void;
}

export const StyleSelector: React.FC<StyleSelectorProps> = ({
  styles,
  selectedStyle,
  onSelect,
}) => {
  // 按分类分组
  const groupedStyles = styles.reduce((acc, style) => {
    if (!acc[style.category]) {
      acc[style.category] = [];
    }
    acc[style.category].push(style);
    return acc;
  }, {} as Record<string, StyleTemplate[]>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedStyles).map(([category, categoryStyles]) => (
        <div key={category}>
          <h3 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wide">
            {category}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categoryStyles.map((style) => (
              <StyleCard
                key={style.id}
                style={style}
                isSelected={selectedStyle?.id === style.id}
                onClick={() => onSelect(style)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

interface StyleCardProps {
  style: StyleTemplate;
  isSelected: boolean;
  onClick: () => void;
}

const StyleCard: React.FC<StyleCardProps> = ({ style, isSelected, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={`
        relative group overflow-hidden rounded-xl border-2 transition-all duration-300
        ${
          isSelected
            ? 'border-pink-500 shadow-lg shadow-pink-500/20'
            : 'border-slate-800 hover:border-slate-700 hover:shadow-lg hover:shadow-slate-500/10'
        }
      `}
    >
      {/* 缩略图 */}
      <div className="aspect-video bg-slate-900 relative overflow-hidden">
        <img
          src={style.thumbnail}
          alt={style.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
        />

        {/* 选中标记 */}
        {isSelected && (
          <div className="absolute top-2 right-2 w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center shadow-lg">
            <Check className="w-5 h-5 text-white" />
          </div>
        )}

        {/* 渐变遮罩 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      </div>

      {/* 信息 */}
      <div className="p-4 bg-black">
        <h4 className="font-bold text-white mb-1 group-hover:text-pink-400 transition-colors">
          {style.name}
        </h4>
        <p className="text-xs text-slate-400 line-clamp-2 mb-2">
          {style.description}
        </p>

        {/* 标签 */}
        <div className="flex flex-wrap gap-1">
          {style.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs bg-slate-800 text-slate-300 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
};

export default StyleSelector;
