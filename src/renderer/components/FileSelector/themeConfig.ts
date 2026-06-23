/**
 * FileSelector 主题配置
 */

export type ThemeColor = 'blue' | 'purple' | 'rose' | 'emerald' | 'amber' | 'violet' | 'indigo' | 'pink' | 'cyan' | 'fuchsia';

export interface ThemeConfig {
  primary: string;
  primaryLight: string;
  glow: string;
  bg: string;
  border: string;
}

/**
 * 获取主题配置
 */
export const getThemeConfig = (color: ThemeColor = 'rose'): ThemeConfig => {
  const configs: Record<string, ThemeConfig> = {
    blue: {
      primary: '#FF385C',
      primaryLight: '#E43150',
      glow: 'rgba(255, 56, 92, 0.16)',
      bg: 'rgba(255, 56, 92, 0.08)',
      border: 'rgba(255, 56, 92, 0.22)'
    },
    purple: {
      primary: '#8b5cf6',
      primaryLight: '#a78bfa',
      glow: 'rgba(139, 92, 246, 0.5)',
      bg: 'rgba(139, 92, 246, 0.05)',
      border: 'rgba(139, 92, 246, 0.3)'
    },
    rose: {
      primary: '#FF385C',
      primaryLight: '#E43150',
      glow: 'rgba(255, 56, 92, 0.16)',
      bg: 'rgba(255, 56, 92, 0.08)',
      border: 'rgba(255, 56, 92, 0.22)'
    },
    emerald: {
      primary: '#10b981',
      primaryLight: '#34d399',
      glow: 'rgba(16, 185, 129, 0.5)',
      bg: 'rgba(16, 185, 129, 0.05)',
      border: 'rgba(16, 185, 129, 0.3)'
    },
    amber: {
      primary: '#f59e0b',
      primaryLight: '#fbbf24',
      glow: 'rgba(245, 158, 11, 0.5)',
      bg: 'rgba(245, 158, 11, 0.05)',
      border: 'rgba(245, 158, 11, 0.3)'
    },
    violet: {
      primary: '#8b5cf6',
      primaryLight: '#a78bfa',
      glow: 'rgba(139, 92, 246, 0.5)',
      bg: 'rgba(139, 92, 246, 0.05)',
      border: 'rgba(139, 92, 246, 0.3)'
    },
    indigo: {
      primary: '#FF385C',
      primaryLight: '#E43150',
      glow: 'rgba(255, 56, 92, 0.16)',
      bg: 'rgba(255, 56, 92, 0.08)',
      border: 'rgba(255, 56, 92, 0.22)'
    },
    pink: {
      primary: '#ec4899',
      primaryLight: '#f472b6',
      glow: 'rgba(236, 72, 153, 0.5)',
      bg: 'rgba(236, 72, 153, 0.05)',
      border: 'rgba(236, 72, 153, 0.3)'
    },
    cyan: {
      primary: '#06b6d4',
      primaryLight: '#22d3ee',
      glow: 'rgba(6, 182, 212, 0.5)',
      bg: 'rgba(6, 182, 212, 0.05)',
      border: 'rgba(6, 182, 212, 0.3)'
    },
    fuchsia: {
      primary: '#d946ef',
      primaryLight: '#e879f9',
      glow: 'rgba(217, 70, 239, 0.5)',
      bg: 'rgba(217, 70, 239, 0.05)',
      border: 'rgba(217, 70, 239, 0.3)'
    }
  };
  // 确保总是返回有效的配置，使用 blue 作为后备
  return configs[color || 'rose'] || configs.rose;
};
