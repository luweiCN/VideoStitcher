/**
 * 角色网格 - 角色卡片展示
 */

import React from 'react';
import { User, Edit2, Trash2 } from 'lucide-react';
import type { Character } from '../types';

interface CharacterGridProps {
  characters: Character[];
  onUpdate: (id: string, updates: Partial<Character>) => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
}

export const CharacterGrid: React.FC<CharacterGridProps> = ({
  characters,
  onUpdate,
  onSelect,
  selectedId,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {characters.map((character) => (
        <div
          key={character.id}
          onClick={() => onSelect(character.id)}
          className={`group relative bg-slate-900 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
            selectedId === character.id
              ? 'border-violet-500 shadow-lg shadow-violet-500/20'
              : 'border-slate-800 hover:border-violet-500/50'
          }`}
        >
          {/* 角色头像 */}
          <div className="aspect-square bg-gradient-to-br from-violet-600/10 to-blue-600/10 flex items-center justify-center">
            {character.imageUrl ? (
              <img
                src={character.imageUrl}
                alt={character.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-20 h-20 text-violet-400/50" />
            )}
          </div>

          {/* 角色信息 */}
          <div className="p-4">
            <h3 className="text-lg font-bold text-white mb-1 truncate">
              {character.name}
            </h3>
            <p className="text-sm text-slate-400 line-clamp-2 mb-3">
              {character.description}
            </p>

            {/* 角色特征标签 */}
            <div className="flex flex-wrap gap-1.5">
              {character.traits.slice(0, 3).map((trait, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-violet-500/10 text-violet-300 text-xs rounded-md"
                >
                  {trait}
                </span>
              ))}
            </div>
          </div>

          {/* 悬停操作按钮 */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect(character.id);
              }}
              className="p-2 bg-slate-800/80 backdrop-blur-sm rounded-lg hover:bg-violet-500 transition-colors"
            >
              <Edit2 className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
