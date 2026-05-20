import { useEffect, useState } from 'react';

export type PageTheme = 'light' | 'dark';

/**
 * 页面主题状态
 *
 * 与首页共用本地缓存，保证不同功能页之间的白天/黑夜模式一致。
 */
export const usePageTheme = () => {
  const [pageTheme, setPageTheme] = useState<PageTheme>(() => {
    const savedTheme = localStorage.getItem('home-theme');
    return savedTheme === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('home-theme', pageTheme);
  }, [pageTheme]);

  const isLightTheme = pageTheme === 'light';

  const togglePageTheme = () => {
    setPageTheme((theme) => (theme === 'light' ? 'dark' : 'light'));
  };

  return {
    pageTheme,
    isLightTheme,
    togglePageTheme,
  };
};
