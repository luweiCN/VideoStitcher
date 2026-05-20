import React from 'react';
import { Moon, Sun } from 'lucide-react';

interface PageThemeToggleProps {
  isLightTheme: boolean;
  onToggle: () => void;
}

/**
 * 功能页白天/黑夜切换按钮
 */
const PageThemeToggle: React.FC<PageThemeToggleProps> = ({ isLightTheme, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
        isLightTheme
          ? 'bg-slate-100/90 text-slate-700 border-slate-300/80 hover:border-violet-200 hover:text-violet-600'
          : 'bg-black text-slate-400 border-slate-800 hover:text-white'
      }`}
      type="button"
    >
      {isLightTheme ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
      {isLightTheme ? '黑夜' : '白天'}
    </button>
  );
};

export default PageThemeToggle;
