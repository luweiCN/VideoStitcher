import { createContext, useContext, useState, ReactNode } from 'react';

export interface VideoMergeState {
  orientation: 'horizontal' | 'vertical';
  bgImages: string[];
  bVideos: string[];
  aVideos: string[];
  cVideos: string[];
  covers: string[];
  taskCount: number;
}

const DEFAULT_STATE: VideoMergeState = {
  orientation: 'horizontal',
  bgImages: [],
  bVideos: [],
  aVideos: [],
  cVideos: [],
  covers: [],
  taskCount: 1,
};

interface VideoMergeContextType {
  state: VideoMergeState;
  setState: (state: Partial<VideoMergeState> | ((prev: VideoMergeState) => VideoMergeState)) => void;
  clearState: () => void;
}

const VideoMergeContext = createContext<VideoMergeContextType | undefined>(undefined);

export const VideoMergeProvider = ({ children }: { children: ReactNode }) => {
  const [state, setInternalState] = useState<VideoMergeState>(DEFAULT_STATE);

  const setState = (update: Partial<VideoMergeState> | ((prev: VideoMergeState) => VideoMergeState)) => {
    setInternalState((prev) => {
      const next = typeof update === 'function' ? update(prev) : { ...prev, ...update };
      return next;
    });
  };

  const clearState = () => {
    setInternalState(DEFAULT_STATE);
  };

  return (
    <VideoMergeContext.Provider value={{ state, setState, clearState }}>
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
