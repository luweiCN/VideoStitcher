import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import type { MaterialPositions } from '@/types';

export interface VideoMergeState {
  orientation: 'horizontal' | 'vertical';
  bgImages: string[];
  bVideos: string[];
  aVideos: string[];
  cVideos: string[];
  covers: string[];
  taskCount: number;
  materialPositions?: MaterialPositions;
  hasCustomBPosition: boolean;
  bPositionLayoutKey: string | null;
}

const DEFAULT_STATE: VideoMergeState = {
  orientation: 'horizontal',
  bgImages: [],
  bVideos: [],
  aVideos: [],
  cVideos: [],
  covers: [],
  taskCount: 1,
  materialPositions: undefined,
  hasCustomBPosition: false,
  bPositionLayoutKey: null,
};

interface VideoMergeContextType {
  state: VideoMergeState;
  setState: (state: Partial<VideoMergeState> | ((prev: VideoMergeState) => VideoMergeState)) => void;
  clearState: () => void;
}

const VideoMergeContext = createContext<VideoMergeContextType | undefined>(undefined);

export const VideoMergeProvider = ({ children }: { children: ReactNode }) => {
  const [state, setInternalState] = useState<VideoMergeState>(DEFAULT_STATE);

  const setState = useCallback((update: Partial<VideoMergeState> | ((prev: VideoMergeState) => VideoMergeState)) => {
    setInternalState((prev) => {
      const next = typeof update === 'function' ? update(prev) : { ...prev, ...update };
      return next;
    });
  }, []);

  const clearState = useCallback(() => {
    setInternalState(DEFAULT_STATE);
  }, []);

  const value = useMemo(
    () => ({ state, setState, clearState }),
    [state, setState, clearState],
  );

  return (
    <VideoMergeContext.Provider value={value}>
      {children}
    </VideoMergeContext.Provider>
  );
};

export const useVideoMergeContext = () => {
  const context = useContext(VideoMergeContext);
  if (!context) {
    throw new Error('useVideoMergeContext must be used within a VideoMergeProvider');
  }
  return context;
};
