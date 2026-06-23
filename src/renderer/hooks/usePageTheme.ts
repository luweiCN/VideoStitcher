import { useEffect, useState } from 'react';
import { HOME_SKIN_STORAGE_KEY } from '@/constants/homeSkins';

export type PageTheme = 'light' | 'dark';

const isMetalSkinSelected = () => localStorage.getItem(HOME_SKIN_STORAGE_KEY) === 'metal-brass';

/**
 * 页面主题状态
 *
 * 与首页共用本地缓存，保证不同功能页之间的白天/黑夜模式一致。
 */
export const usePageTheme = () => {
  const [pageTheme, setPageTheme] = useState<PageTheme>(() => {
    if (isMetalSkinSelected()) return 'dark';

    const savedTheme = localStorage.getItem('home-theme');
    return savedTheme === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    if (isMetalSkinSelected()) {
      if (pageTheme !== 'dark') {
        setPageTheme('dark');
      }
      localStorage.setItem('home-theme', 'dark');
      return;
    }

    localStorage.setItem('home-theme', pageTheme);
  }, [pageTheme]);

  useEffect(() => {
    const syncThemeBySkin = () => {
      if (isMetalSkinSelected()) {
        localStorage.setItem('home-theme', 'dark');
        setPageTheme('dark');
      }
    };

    window.addEventListener('home-skin-changed', syncThemeBySkin);
    window.addEventListener('storage', syncThemeBySkin);

    return () => {
      window.removeEventListener('home-skin-changed', syncThemeBySkin);
      window.removeEventListener('storage', syncThemeBySkin);
    };
  }, []);

  const isLightTheme = pageTheme === 'light';

  const togglePageTheme = () => {
    if (isMetalSkinSelected()) {
      localStorage.setItem('home-theme', 'dark');
      setPageTheme('dark');
      return;
    }

    setPageTheme((theme) => (theme === 'light' ? 'dark' : 'light'));
  };

  return {
    pageTheme,
    isLightTheme,
    togglePageTheme,
  };
};
