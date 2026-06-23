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
          ? 'bg-white text-[#444444] border-[#E7E5DF] hover:bg-[#F3F3EF] hover:border-[#DDD8CF] hover:text-[#222222]'
          : 'bg-[#2A2A2A] text-[#D1D1D1] border-[#3B3B3B] hover:bg-[#353535] hover:text-[#F2F2F2]'
      }`}
      type="button"
    >
      {isLightTheme ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
      {isLightTheme ? '黑夜' : '白天'}
    </button>
  );
};

export default PageThemeToggle;
