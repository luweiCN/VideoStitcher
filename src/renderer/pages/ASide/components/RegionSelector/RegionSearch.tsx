/**
 * 区域搜索组件
 * 支持拼音搜索的搜索框
 */

import { Search } from 'lucide-react';

/**
 * RegionSearch 组件 Props
 */
interface RegionSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * 区域搜索组件
 * 居中显示的搜索框，支持拼音搜索
 */
export function RegionSearch({ value, onChange, placeholder = '搜索地区（支持拼音）' }: RegionSearchProps) {
  return (
    <div className="relative w-full max-w-md mx-auto">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="
          w-full pl-10 pr-4 py-3
          bg-black/50 border border-slate-800 rounded-lg
          text-slate-100 placeholder-slate-500
          focus:outline-none focus:border-slate-700
        "
      />
    </div>
  );
}
