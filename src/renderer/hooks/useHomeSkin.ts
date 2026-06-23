import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_HOME_SKIN_ID,
  HOME_SKIN_STORAGE_KEY,
  getHomeSkinById,
  isHomeSkinId,
  type HomeSkinId,
} from '@/constants/homeSkins';

export const readSavedHomeSkin = (): HomeSkinId => {
  const savedSkin = localStorage.getItem(HOME_SKIN_STORAGE_KEY);
  return isHomeSkinId(savedSkin) ? savedSkin : DEFAULT_HOME_SKIN_ID;
};

export const getWorkspaceSkinClassName = (skinId: HomeSkinId): string => {
  return skinId === 'metal-brass' ? 'video-merge-metal' : 'video-merge-airbnb';
};

export const useHomeSkin = () => {
  const [homeSkinId, setHomeSkinId] = useState<HomeSkinId>(() => readSavedHomeSkin());

  useEffect(() => {
    const handleSkinChanged = () => {
      setHomeSkinId(readSavedHomeSkin());
    };

    window.addEventListener('home-skin-changed', handleSkinChanged);
    window.addEventListener('storage', handleSkinChanged);

    return () => {
      window.removeEventListener('home-skin-changed', handleSkinChanged);
      window.removeEventListener('storage', handleSkinChanged);
    };
  }, []);

  const homeSkin = useMemo(() => getHomeSkinById(homeSkinId), [homeSkinId]);
  const workspaceSkinClassName = getWorkspaceSkinClassName(homeSkinId);

  return {
    homeSkin,
    homeSkinId,
    isMetalSkin: homeSkinId === 'metal-brass',
    workspaceSkinClassName,
  };
};
