import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  Check,
  Clock3,
  FileImage,
  FileVideo2,
  Film,
  FolderCog,
  Grid2X2,
  Image as ImageIcon,
  Layers3,
  Library,
  MapPin,
  Play,
  Plus,
  RefreshCw,
  Search,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Sticker,
  Trash2,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import PageThemeToggle from '@/components/PageThemeToggle';
import OutputDirSelector from '@/components/OutputDirSelector';
import { FileSelector, FileSelectorGroup, type FileSelectorRef } from '@/components/FileSelector';
import TaskAddedDialog from '@/components/TaskAddedDialog';
import { useToastMessages } from '@/components/Toast';
import { useTaskContext } from '@/contexts/TaskContext';
import { useHomeSkin } from '@/hooks/useHomeSkin';
import { usePageTheme } from '@/hooks/usePageTheme';
import type { Task } from '@shared/types/task';
import {
  DEFAULT_GREEN_SCREEN_RECIPE,
  DEFAULT_VIDEO_DEDUP_POSITIONS,
  buildVideoDedupSchedule,
  type GreenScreenRecipe,
  type VideoDedupElement,
  type VideoDedupEvent,
  type VideoDedupLibraryScanResult,
  type VideoDedupPosition,
  type VideoDedupTaskConfig,
} from '@shared/videoDedup';

type WorkspaceMode = 'process' | 'library';
type ScheduleMode = 'slots' | 'random';
type MaterialFilter = 'all' | 'image' | 'gif' | 'green';

const ELEMENT_SCALE_PRESETS = [12, 22, 32] as const;
const DEFAULT_ELEMENT_SCALE_PERCENT = 22;
const CUSTOM_ELEMENT_SCALE_PERCENT = 25;
const MIN_ELEMENT_SCALE_PERCENT = 5;
const MAX_ELEMENT_SCALE_PERCENT = 50;
const MIN_MANUAL_TIMELINE_DURATION = 0.1;
const DEFAULT_MINIMUM_GAP = 0.01;
const GENERATION_RULES_STORAGE_KEY = 'video-dedup-generation-rules';

interface GenerationRules {
  copies: number;
  overlaysPerVideo: number;
  minDuration: number;
  maxDuration: number;
}

type TimelineEditMode = 'move' | 'resize-start' | 'resize-end';

interface TimelineEditSession {
  eventArrayIndex: number;
  mode: TimelineEditMode;
  pointerStartX: number;
  trackWidth: number;
  initialStart: number;
  initialEnd: number;
  lowerBoundary: number;
  upperBoundary: number;
  minDuration: number;
  maxDuration: number;
}

const DEFAULT_GENERATION_RULES: GenerationRules = {
  copies: 1,
  overlaysPerVideo: 3,
  minDuration: 4,
  maxDuration: 5,
};

const normalizeStoredNumber = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  integer = false,
): number => {
  if (value === null || value === undefined || value === '') return fallback;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  const normalizedValue = integer ? Math.round(numericValue) : numericValue;
  return Math.min(max, Math.max(min, normalizedValue));
};

const readStoredGenerationRules = (): GenerationRules => {
  const storedRules = localStorage.getItem(GENERATION_RULES_STORAGE_KEY);
  if (!storedRules) return { ...DEFAULT_GENERATION_RULES };

  try {
    const parsed = JSON.parse(storedRules) as Partial<GenerationRules>;
    return {
      copies: normalizeStoredNumber(parsed.copies, DEFAULT_GENERATION_RULES.copies, 1, 20, true),
      overlaysPerVideo: normalizeStoredNumber(
        parsed.overlaysPerVideo,
        DEFAULT_GENERATION_RULES.overlaysPerVideo,
        1,
        30,
        true,
      ),
      minDuration: normalizeStoredNumber(parsed.minDuration, DEFAULT_GENERATION_RULES.minDuration, 0.5, 30),
      maxDuration: normalizeStoredNumber(parsed.maxDuration, DEFAULT_GENERATION_RULES.maxDuration, 0.5, 30),
    };
  } catch {
    return { ...DEFAULT_GENERATION_RULES };
  }
};

const roundTimelineTime = (value: number): number => Math.round(value * 1000) / 1000;

const clampTimelineTime = (value: number, min: number, max: number, fallback: number): number => {
  if (max < min) return fallback;
  return Math.min(max, Math.max(min, value));
};

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  onChange: (value: number) => void;
}

const NumberField: React.FC<NumberFieldProps> = ({ label, value, min, max, step, suffix, onChange }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
    <span className="flex h-10 items-center rounded-lg border border-slate-800 bg-black/40 px-3">
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          if (Number.isFinite(nextValue)) onChange(Math.min(max, Math.max(min, nextValue)));
        }}
        className="min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold text-slate-200 outline-none"
      />
      <span className="ml-2 text-xs text-slate-500">{suffix}</span>
    </span>
  </label>
);

const SectionTitle: React.FC<{
  icon: typeof SlidersHorizontal;
  title: string;
  description?: string;
}> = ({ icon: Icon, title, description }) => (
  <div className="flex items-start gap-2.5">
    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
      <Icon className="h-3.5 w-3.5" />
    </span>
    <span>
      <span className="block text-sm font-bold text-slate-200">{title}</span>
      {description && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>}
    </span>
  </div>
);

const ModeSwitcher: React.FC<{ mode: WorkspaceMode; onChange: (mode: WorkspaceMode) => void }> = ({
  mode,
  onChange,
}) => (
  <div className="metal-top-switch flex items-center rounded-lg border border-slate-800 bg-black/40 p-1">
    <button
      type="button"
      data-testid="video-dedup-mode-process"
      onClick={() => onChange('process')}
      className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-bold transition-all ${
        mode === 'process'
          ? 'metal-primary bg-[#FF385C] text-white shadow-sm'
          : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      <Shuffle className="h-3.5 w-3.5" />
      批量处理
    </button>
    <button
      type="button"
      data-testid="video-dedup-mode-library"
      onClick={() => onChange('library')}
      className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-bold transition-all ${
        mode === 'library'
          ? 'metal-primary bg-[#FF385C] text-white shadow-sm'
          : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      <Library className="h-3.5 w-3.5" />
      变体元素库
    </button>
  </div>
);

const VideoDedupMode: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToastMessages();
  const { batchCreateTasks } = useTaskContext();
  const sourceSelectorRef = useRef<FileSelectorRef>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewPathRef = useRef('');
  const timelineTrackRef = useRef<HTMLDivElement>(null);
  const thumbnailAttemptedPathsRef = useRef<Set<string>>(new Set());
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('process');
  const [sourceVideos, setSourceVideos] = useState<string[]>([]);
  const [outputDir, setOutputDir] = useState(() => localStorage.getItem('video-dedup-output-dir') || '');
  const [libraryRoot, setLibraryRoot] = useState(() => localStorage.getItem('video-dedup-library-root') || '');
  const [initialGenerationRules] = useState(readStoredGenerationRules);
  const [copies, setCopies] = useState(initialGenerationRules.copies);
  const [overlaysPerVideo, setOverlaysPerVideo] = useState(initialGenerationRules.overlaysPerVideo);
  const [minDuration, setMinDuration] = useState(initialGenerationRules.minDuration);
  const [maxDuration, setMaxDuration] = useState(initialGenerationRules.maxDuration);
  const [skipHead, setSkipHead] = useState(1);
  const [skipTail, setSkipTail] = useState(1);
  const [minimumGap, setMinimumGap] = useState(DEFAULT_MINIMUM_GAP);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('slots');
  const [elementScalePercent, setElementScalePercent] = useState(() => {
    const storedScale = localStorage.getItem('video-dedup-element-scale');
    if (storedScale === null) return DEFAULT_ELEMENT_SCALE_PERCENT;
    const storedValue = Number(storedScale);
    if (!Number.isFinite(storedValue)) return DEFAULT_ELEMENT_SCALE_PERCENT;
    return Math.min(MAX_ELEMENT_SCALE_PERCENT, Math.max(MIN_ELEMENT_SCALE_PERCENT, Math.round(storedValue)));
  });
  const [materialFilter, setMaterialFilter] = useState<MaterialFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [enabledPositions, setEnabledPositions] = useState<VideoDedupPosition[]>(DEFAULT_VIDEO_DEDUP_POSITIONS);
  const [libraryScan, setLibraryScan] = useState<VideoDedupLibraryScanResult | null>(null);
  const [isScanningLibrary, setIsScanningLibrary] = useState(false);
  const [selectedElementPath, setSelectedElementPath] = useState('');
  const [elementThumbnails, setElementThumbnails] = useState<Record<string, string>>({});
  const [greenRecipe, setGreenRecipe] = useState<GreenScreenRecipe>(DEFAULT_GREEN_SCREEN_RECIPE);
  const [greenPreview, setGreenPreview] = useState('');
  const [greenPreviewError, setGreenPreviewError] = useState('');
  const [isPreviewingGreen, setIsPreviewingGreen] = useState(false);
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);
  const [isAddingTasks, setIsAddingTasks] = useState(false);
  const [showTaskAddedDialog, setShowTaskAddedDialog] = useState(false);
  const [addedTaskCount, setAddedTaskCount] = useState(0);
  const [previewPath, setPreviewPath] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewEvents, setPreviewEvents] = useState<VideoDedupEvent[]>([]);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [previewStep, setPreviewStep] = useState('');
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewSignature, setPreviewSignature] = useState('');
  const [isTimelineEdited, setIsTimelineEdited] = useState(false);
  const [hasCustomTimeline, setHasCustomTimeline] = useState(false);
  const [selectedTimelineEventIndex, setSelectedTimelineEventIndex] = useState<number | null>(null);
  const [timelineEditSession, setTimelineEditSession] = useState<TimelineEditSession | null>(null);
  const previewEventsRef = useRef<VideoDedupEvent[]>([]);
  const previewDurationRef = useRef(0);
  const previewSignatureRef = useRef('');
  const isTimelineEditedRef = useRef(false);
  const { isLightTheme, togglePageTheme } = usePageTheme();
  const { isMetalSkin, workspaceSkinClassName } = useHomeSkin();

  previewEventsRef.current = previewEvents;
  previewDurationRef.current = previewDuration;
  previewSignatureRef.current = previewSignature;
  isTimelineEditedRef.current = isTimelineEdited;

  const updatePreviewEvents = useCallback((
    update: VideoDedupEvent[] | ((current: VideoDedupEvent[]) => VideoDedupEvent[]),
  ) => {
    const nextEvents = typeof update === 'function'
      ? update(previewEventsRef.current)
      : update;
    previewEventsRef.current = nextEvents;
    setPreviewEvents(nextEvents);
  }, []);

  const markTimelineEdited = useCallback(() => {
    isTimelineEditedRef.current = true;
    setIsTimelineEdited(true);
    setHasCustomTimeline(true);
  }, []);

  useEffect(() => {
    const generationRules: GenerationRules = {
      copies,
      overlaysPerVideo,
      minDuration,
      maxDuration,
    };
    localStorage.setItem(GENERATION_RULES_STORAGE_KEY, JSON.stringify(generationRules));
  }, [copies, maxDuration, minDuration, overlaysPerVideo]);

  const plannedOutputCount = useMemo(
    () => sourceVideos.length * copies,
    [copies, sourceVideos.length],
  );
  const elementScaleProgress = (
    (elementScalePercent - MIN_ELEMENT_SCALE_PERCENT)
    / (MAX_ELEMENT_SCALE_PERCENT - MIN_ELEMENT_SCALE_PERCENT)
  ) * 100;

  const selectedElement = useMemo(
    () => libraryScan?.elements.find((element) => element.path === selectedElementPath) || null,
    [libraryScan, selectedElementPath],
  );

  const filteredElements = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    return (libraryScan?.elements || []).filter((element) => {
      const matchesType = materialFilter === 'all'
        || (materialFilter === 'green' ? element.type === 'green_video' : element.type === materialFilter);
      const matchesSearch = !normalizedSearch || element.name.toLowerCase().includes(normalizedSearch);
      return matchesType && matchesSearch;
    });
  }, [libraryScan, materialFilter, searchText]);

  const displayedElements = useMemo(
    () => {
      if (materialFilter !== 'all') return filteredElements.slice(0, 120);
      return (['image', 'gif', 'green_video'] as const).flatMap((type) => (
        filteredElements.filter((element) => element.type === type).slice(0, 40)
      ));
    },
    [filteredElements, materialFilter],
  );

  const displayedElementGroups = useMemo(() => ([
    {
      type: 'image' as const,
      title: '静态贴纸',
      formats: 'PNG / WebP / JPG',
      icon: FileImage,
      color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    },
    {
      type: 'gif' as const,
      title: 'GIF 动态贴纸',
      formats: 'GIF',
      icon: Sticker,
      color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    },
    {
      type: 'green_video' as const,
      title: '绿幕视频',
      formats: 'MP4 / MOV / M4V',
      icon: FileVideo2,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
  ].map((group) => ({
    ...group,
    count: filteredElements.filter((element) => element.type === group.type).length,
    elements: displayedElements.filter((element) => element.type === group.type),
  })).filter((group) => group.elements.length > 0)), [displayedElements, filteredElements]);

  const currentPreviewSignature = useMemo(() => JSON.stringify({
    source: sourceVideos[0] || '',
    libraryRoot,
    libraryVersion: (libraryScan?.elements || []).reduce(
      (sum, element) => sum + element.modifiedAt + element.size,
      0,
    ),
    overlaysPerVideo,
    minDuration,
    maxDuration,
    skipHead,
    skipTail,
    minimumGap,
    scheduleMode,
    enabledPositions,
    elementScalePercent,
  }), [
    elementScalePercent,
    enabledPositions,
    libraryRoot,
    libraryScan,
    maxDuration,
    minDuration,
    minimumGap,
    overlaysPerVideo,
    scheduleMode,
    skipHead,
    skipTail,
    sourceVideos,
  ]);

  const canRenderEditedTimeline = Boolean(
    isTimelineEdited
    && previewEvents.length > 0
    && previewSignature === currentPreviewSignature,
  );
  const isPreviewStale = Boolean(
    previewUrl
    && (previewSignature !== currentPreviewSignature || isTimelineEdited),
  );
  const selectedTimelineEvent = selectedTimelineEventIndex === null
    ? null
    : previewEvents[selectedTimelineEventIndex] || null;

  useEffect(() => {
    if (!timelineEditSession) return undefined;

    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = timelineEditSession.mode === 'move' ? 'grabbing' : 'ew-resize';

    const handlePointerMove = (event: PointerEvent) => {
      const deltaSeconds = (
        (event.clientX - timelineEditSession.pointerStartX)
        / timelineEditSession.trackWidth
      ) * previewDuration;
      let nextStart = timelineEditSession.initialStart;
      let nextEnd = timelineEditSession.initialEnd;

      if (timelineEditSession.mode === 'move') {
        const duration = timelineEditSession.initialEnd - timelineEditSession.initialStart;
        nextStart = clampTimelineTime(
          timelineEditSession.initialStart + deltaSeconds,
          timelineEditSession.lowerBoundary,
          timelineEditSession.upperBoundary - duration,
          timelineEditSession.initialStart,
        );
        nextEnd = nextStart + duration;
      } else if (timelineEditSession.mode === 'resize-start') {
        nextStart = clampTimelineTime(
          timelineEditSession.initialStart + deltaSeconds,
          Math.max(
            timelineEditSession.lowerBoundary,
            timelineEditSession.initialEnd - timelineEditSession.maxDuration,
          ),
          timelineEditSession.initialEnd - timelineEditSession.minDuration,
          timelineEditSession.initialStart,
        );
      } else {
        nextEnd = clampTimelineTime(
          timelineEditSession.initialEnd + deltaSeconds,
          timelineEditSession.initialStart + timelineEditSession.minDuration,
          Math.min(
            timelineEditSession.upperBoundary,
            timelineEditSession.initialStart + timelineEditSession.maxDuration,
          ),
          timelineEditSession.initialEnd,
        );
      }

      nextStart = roundTimelineTime(nextStart);
      nextEnd = roundTimelineTime(nextEnd);
      const changed = Math.abs(nextStart - timelineEditSession.initialStart) > 0.001
        || Math.abs(nextEnd - timelineEditSession.initialEnd) > 0.001;
      if (!changed) return;

      updatePreviewEvents((current) => current.map((timelineEvent, index) => (
        index === timelineEditSession.eventArrayIndex
          ? {
            ...timelineEvent,
            start: nextStart,
            end: nextEnd,
            duration: roundTimelineTime(nextEnd - nextStart),
          }
          : timelineEvent
      )));
      markTimelineEdited();
    };

    const handlePointerUp = () => {
      setTimelineEditSession(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('pointercancel', handlePointerUp, { once: true });

    return () => {
      document.body.style.cursor = previousCursor;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [markTimelineEdited, previewDuration, timelineEditSession, updatePreviewEvents]);

  const scanLibrary = useCallback(async (rootDir: string, showMessage = false) => {
    if (!rootDir) {
      setLibraryScan(null);
      return;
    }

    setIsScanningLibrary(true);
    thumbnailAttemptedPathsRef.current.clear();
    setElementThumbnails({});
    try {
      const result = await window.api.scanVideoDedupLibrary(rootDir);
      setLibraryScan(result);
      if (result.success && result.elements.length === 1 && result.elements[0].type === 'green_video') {
        setSelectedElementPath(result.elements[0].path);
      }
      if (showMessage) {
        if (result.success) toast.success(`已扫描 ${result.elements.length} 个变体元素`);
        else toast.error(result.error || '元素库扫描失败');
      }
    } catch (error) {
      setLibraryScan(null);
      if (showMessage) toast.error(`元素库扫描失败：${(error as Error).message}`);
    } finally {
      setIsScanningLibrary(false);
    }
  }, [toast]);

  useEffect(() => {
    if (libraryRoot) void scanLibrary(libraryRoot);
  }, [libraryRoot, scanLibrary]);

  useEffect(() => {
    if (!selectedElement || selectedElement.type !== 'green_video') {
      setGreenRecipe(DEFAULT_GREEN_SCREEN_RECIPE);
      setGreenPreview('');
      setGreenPreviewError('');
      return;
    }
    setGreenRecipe(selectedElement.recipe || DEFAULT_GREEN_SCREEN_RECIPE);
  }, [selectedElement]);

  useEffect(() => {
    if (!selectedElement || selectedElement.type !== 'green_video') return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsPreviewingGreen(true);
      setGreenPreviewError('');
      try {
        const result = await window.api.previewVideoDedupGreenElement(selectedElement.path, greenRecipe);
        if (!cancelled) {
          setGreenPreview(result.success && result.preview ? result.preview : '');
          setGreenPreviewError(result.success ? '' : result.error || '绿幕抠色预览失败');
        }
      } catch {
        if (!cancelled) {
          setGreenPreview('');
          setGreenPreviewError('绿幕抠色预览失败');
        }
      } finally {
        if (!cancelled) setIsPreviewingGreen(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [greenRecipe, selectedElement]);

  useEffect(() => {
    const pendingElements = displayedElements
      .filter((element) => (
        !elementThumbnails[element.path]
        && !thumbnailAttemptedPathsRef.current.has(element.path)
      ))
      .slice(0, 36);
    if (pendingElements.length === 0) return;

    pendingElements.forEach((element) => {
      thumbnailAttemptedPathsRef.current.add(element.path);
    });

    let cancelled = false;
    const loadThumbnails = async () => {
      for (let index = 0; index < pendingElements.length; index += 4) {
        const batch = pendingElements.slice(index, index + 4);
        const results = await Promise.all(batch.map(async (element) => {
          try {
            if (element.type === 'image') {
              const result = await window.api.getPreviewThumbnail(element.path, 160);
              return result.success && result.thumbnail ? [element.path, result.thumbnail] as const : null;
            }
            const result = await window.api.getVideoThumbnail(element.path, { timeOffset: 0.2, maxSize: 160 });
            return result.success && result.thumbnail ? [element.path, result.thumbnail] as const : null;
          } catch {
            return null;
          }
        }));
        if (cancelled) return;
        setElementThumbnails((current) => {
          const next = { ...current };
          results.forEach((result) => {
            if (result) next[result[0]] = result[1];
          });
          return next;
        });
      }
    };

    void loadThumbnails();
    return () => {
      cancelled = true;
    };
  }, [displayedElements, elementThumbnails]);

  useEffect(() => {
    if (!window.api.onVideoDedupPreviewProgress) return undefined;
    return window.api.onVideoDedupPreviewProgress(({ progress, step }) => {
      setPreviewProgress(progress);
      setPreviewStep(step);
    });
  }, []);

  useEffect(() => () => {
    if (previewPathRef.current && window.api.deleteVideoDedupPreview) {
      void window.api.deleteVideoDedupPreview(previewPathRef.current);
    }
  }, []);

  const handleLibraryRootChange = useCallback((rootDir: string) => {
    setLibraryRoot(rootDir);
    localStorage.setItem('video-dedup-library-root', rootDir);
    setSelectedElementPath('');
  }, []);

  const handleOutputDirChange = useCallback((dir: string) => {
    setOutputDir(dir);
    localStorage.setItem('video-dedup-output-dir', dir);
  }, []);

  const togglePosition = useCallback((position: VideoDedupPosition) => {
    setEnabledPositions((current) => {
      if (current.includes(position)) {
        return current.length === 1 ? current : current.filter((item) => item !== position);
      }
      return [...current, position];
    });
  }, []);

  const handleElementScaleChange = useCallback((value: number) => {
    const normalizedValue = Math.min(
      MAX_ELEMENT_SCALE_PERCENT,
      Math.max(MIN_ELEMENT_SCALE_PERCENT, Math.round(value)),
    );
    setElementScalePercent(normalizedValue);
    localStorage.setItem('video-dedup-element-scale', String(normalizedValue));
  }, []);

  const handleTimelinePointerDown = useCallback((
    pointerEvent: React.PointerEvent<HTMLElement>,
    eventArrayIndex: number,
    mode: TimelineEditMode,
  ) => {
    if (isGeneratingPreview) return;
    const trackWidth = timelineTrackRef.current?.getBoundingClientRect().width || 0;
    const timelineEvent = previewEvents[eventArrayIndex];
    if (!timelineEvent || trackWidth <= 0 || previewDuration <= 0) return;

    pointerEvent.preventDefault();
    pointerEvent.stopPropagation();
    const previousEvent = previewEvents[eventArrayIndex - 1];
    const nextEvent = previewEvents[eventArrayIndex + 1];
    const lowerBoundary = Math.max(
      0,
      skipHead,
      previousEvent ? previousEvent.end + minimumGap : 0,
    );
    const upperBoundary = Math.min(
      previewDuration,
      previewDuration - Math.max(0, skipTail),
      nextEvent ? nextEvent.start - minimumGap : previewDuration,
    );

    setSelectedTimelineEventIndex(eventArrayIndex);
    setTimelineEditSession({
      eventArrayIndex,
      mode,
      pointerStartX: pointerEvent.clientX,
      trackWidth,
      initialStart: timelineEvent.start,
      initialEnd: timelineEvent.end,
      lowerBoundary,
      upperBoundary,
      minDuration: MIN_MANUAL_TIMELINE_DURATION,
      maxDuration: Math.max(MIN_MANUAL_TIMELINE_DURATION, upperBoundary - lowerBoundary),
    });

    if (previewVideoRef.current) {
      previewVideoRef.current.currentTime = Math.min(
        timelineEvent.start + timelineEvent.duration / 2,
        Math.max(0, previewDuration - 0.05),
      );
    }
  }, [isGeneratingPreview, minimumGap, previewDuration, previewEvents, skipHead, skipTail]);

  const handleAddTimelineEvent = useCallback(() => {
    if (isGeneratingPreview) return;
    if (!libraryScan?.success || libraryScan.elements.length === 0 || previewDuration <= 0) {
      toast.warning('请先生成包含可用变体元素的效果预览');
      return;
    }

    const rangeStart = Math.max(0, skipHead);
    const rangeEnd = Math.min(previewDuration, previewDuration - Math.max(0, skipTail));
    const currentEvents = previewEventsRef.current;
    const sortedEvents = [...currentEvents].sort((left, right) => left.start - right.start);
    const freeRanges: Array<{ start: number; end: number; capacity: number }> = [];
    let cursor = rangeStart;

    sortedEvents.forEach((timelineEvent) => {
      const freeEnd = Math.min(rangeEnd, timelineEvent.start - minimumGap);
      if (freeEnd - cursor >= MIN_MANUAL_TIMELINE_DURATION) {
        freeRanges.push({ start: cursor, end: freeEnd, capacity: freeEnd - cursor });
      }
      cursor = Math.max(cursor, timelineEvent.end + minimumGap);
    });

    if (rangeEnd - cursor >= MIN_MANUAL_TIMELINE_DURATION) {
      freeRanges.push({ start: cursor, end: rangeEnd, capacity: rangeEnd - cursor });
    }
    if (freeRanges.length === 0) {
      toast.warning('时间轴没有可容纳新变体的空档，请先移动或缩短现有片段');
      return;
    }

    const preferredRanges = freeRanges.filter((range) => range.capacity >= 3);
    const candidateRanges = preferredRanges.length > 0
      ? preferredRanges
      : [freeRanges.reduce((largest, range) => (range.capacity > largest.capacity ? range : largest))];
    const selectedRange = candidateRanges[Math.floor(Math.random() * candidateRanges.length)];
    const duration = roundTimelineTime(Math.min(3, selectedRange.capacity));
    const availableSlack = Math.max(0, selectedRange.capacity - duration);
    const start = roundTimelineTime(selectedRange.start + Math.random() * availableSlack);
    const end = roundTimelineTime(start + duration);
    const element = libraryScan.elements[Math.floor(Math.random() * libraryScan.elements.length)];
    const position = enabledPositions[Math.floor(Math.random() * enabledPositions.length)] || 'top_left';
    const newEvent: VideoDedupEvent = {
      index: currentEvents.length,
      elementPath: element.path,
      elementType: element.type,
      start,
      duration: roundTimelineTime(end - start),
      end,
      position,
      recipe: element.recipe,
    };
    const nextEvents = [...currentEvents, newEvent]
      .sort((left, right) => left.start - right.start)
      .map((timelineEvent, index) => ({ ...timelineEvent, index }));
    const nextSelectedIndex = nextEvents.findIndex((timelineEvent) => timelineEvent === newEvent
      || (timelineEvent.elementPath === newEvent.elementPath
        && timelineEvent.start === newEvent.start
        && timelineEvent.end === newEvent.end));

    updatePreviewEvents(nextEvents);
    setSelectedTimelineEventIndex(nextSelectedIndex);
    markTimelineEdited();
    if (previewVideoRef.current) {
      previewVideoRef.current.currentTime = Math.min(
        start + duration / 2,
        Math.max(0, previewDuration - 0.05),
      );
    }
  }, [
    enabledPositions,
    isGeneratingPreview,
    libraryScan,
    markTimelineEdited,
    minimumGap,
    previewDuration,
    skipHead,
    skipTail,
    toast,
    updatePreviewEvents,
  ]);

  const handleDeleteSelectedTimelineEvent = useCallback(() => {
    if (isGeneratingPreview) return;
    if (selectedTimelineEventIndex === null) return;
    const currentEvents = previewEventsRef.current;
    if (currentEvents.length <= 1) {
      toast.warning('时间轴至少需要保留一个变体，请先增加新变体再删除');
      return;
    }

    const nextEvents = currentEvents
      .filter((_, index) => index !== selectedTimelineEventIndex)
      .map((timelineEvent, index) => ({ ...timelineEvent, index }));
    updatePreviewEvents(nextEvents);
    setSelectedTimelineEventIndex(null);
    setTimelineEditSession(null);
    markTimelineEdited();
  }, [isGeneratingPreview, markTimelineEdited, selectedTimelineEventIndex, toast, updatePreviewEvents]);

  const handleSaveRecipe = useCallback(async () => {
    if (!selectedElement || selectedElement.type !== 'green_video') return;
    setIsSavingRecipe(true);
    try {
      const result = await window.api.saveVideoDedupGreenRecipe(selectedElement.path, greenRecipe);
      if (!result.success || !result.recipe) {
        toast.error(result.error || '保存抠色配方失败');
        return;
      }
      setGreenRecipe(result.recipe);
      setLibraryScan((current) => current ? {
        ...current,
        elements: current.elements.map((element) => (
          element.path === selectedElement.path ? { ...element, recipe: result.recipe } : element
        )),
        missingRecipes: Math.max(0, current.elements.filter(
          (element) => element.type === 'green_video' && !element.recipe && element.path !== selectedElement.path,
        ).length),
      } : current);
      toast.success('绿幕抠色配方已保存');
    } catch (error) {
      toast.error(`保存抠色配方失败：${(error as Error).message}`);
    } finally {
      setIsSavingRecipe(false);
    }
  }, [greenRecipe, selectedElement, toast]);

  const createRandomSeed = (): number => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0];
  };

  const validateGreenElements = useCallback(async (elements: VideoDedupElement[]) => {
    const uniqueGreenElements = [...new Map(
      elements
        .filter((element) => element.type === 'green_video')
        .map((element) => [element.path, element]),
    ).values()];

    for (const element of uniqueGreenElements) {
      const result = await window.api.previewVideoDedupGreenElement(
        element.path,
        element.recipe || DEFAULT_GREEN_SCREEN_RECIPE,
      );
      if (!result.success) {
        throw new Error(`${element.name}：${result.error || '绿幕抠色参数校验失败'}`);
      }
    }
  }, []);

  const handlePreviewLoadedMetadata = useCallback(() => {
    const video = previewVideoRef.current;
    const firstEvent = previewEvents[0];
    if (!video || !firstEvent || !Number.isFinite(video.duration)) return;

    const eventMiddle = firstEvent.start + firstEvent.duration / 2;
    video.currentTime = Math.min(eventMiddle, Math.max(0, video.duration - 0.05));
  }, [previewEvents]);

  const handleGeneratePreview = useCallback(async () => {
    const sourcePath = sourceVideos[0];
    if (!sourcePath) {
      toast.warning('请先选择至少一条待处理视频');
      return;
    }
    if (!libraryScan?.success || libraryScan.elements.length === 0) {
      toast.warning('请先设置包含可用内容的变体元素库');
      return;
    }

    setIsGeneratingPreview(true);
    setPreviewProgress(0);
    setPreviewStep('正在读取原视频');
    try {
      const metadata = await window.api.getVideoMetadata(sourcePath);
      const randomSeed = createRandomSeed();
      // 点击重新渲染时立即冻结当前时间轴，避免 React 状态提交时序导致少渲染一次新增变体
      const previewEventsSnapshot = previewEventsRef.current.map((event) => ({ ...event }));
      const shouldRenderEditedTimeline = isTimelineEditedRef.current
        && previewEventsSnapshot.length > 0
        && previewSignatureRef.current === currentPreviewSignature
        && Math.abs(metadata.duration - previewDurationRef.current) < 0.05;
      const scheduleConfig = {
        eventCount: shouldRenderEditedTimeline ? previewEventsSnapshot.length : overlaysPerVideo,
        minDuration,
        maxDuration,
        skipHead,
        skipTail,
        minimumGap,
        scheduleMode,
        positions: enabledPositions,
        randomSeed,
      };
      const events = shouldRenderEditedTimeline
        ? previewEventsSnapshot
        : buildVideoDedupSchedule(metadata.duration, libraryScan.elements, scheduleConfig);
      const usedPaths = new Set(events.map((event) => event.elementPath));
      const config: VideoDedupTaskConfig = {
        ...scheduleConfig,
        elements: libraryScan.elements.filter((element) => usedPaths.has(element.path)),
        events,
        variantIndex: 1,
        elementScale: elementScalePercent / 100,
        previewMode: true,
      };

      await validateGreenElements(config.elements);

      const previousPreviewPath = previewPathRef.current;
      const result = await window.api.generateVideoDedupPreview(sourcePath, config);
      if (!result.success || !result.previewPath) {
        throw new Error(result.error || '生成效果预览失败');
      }
      const renderedEvents = result.events || events;
      if (shouldRenderEditedTimeline && renderedEvents.length !== previewEventsSnapshot.length) {
        throw new Error(`重新渲染的变体数量不一致：期望 ${previewEventsSnapshot.length} 个，实际 ${renderedEvents.length} 个`);
      }
      if (previousPreviewPath && previousPreviewPath !== result.previewPath) {
        await window.api.deleteVideoDedupPreview(previousPreviewPath);
      }
      const previewResult = await window.api.getPreviewUrl(result.previewPath);
      if (!previewResult.success || !previewResult.url) {
        throw new Error(previewResult.error || '无法加载效果预览');
      }

      previewPathRef.current = result.previewPath;
      setPreviewPath(result.previewPath);
      setPreviewUrl(previewResult.url);
      previewEventsRef.current = renderedEvents;
      previewDurationRef.current = metadata.duration;
      previewSignatureRef.current = currentPreviewSignature;
      isTimelineEditedRef.current = false;
      setPreviewEvents(renderedEvents);
      setPreviewDuration(metadata.duration);
      setPreviewSignature(currentPreviewSignature);
      setIsTimelineEdited(false);
      setHasCustomTimeline(shouldRenderEditedTimeline);
      if (!shouldRenderEditedTimeline) setSelectedTimelineEventIndex(null);
      setPreviewProgress(100);
      setPreviewStep('预览生成完成');
      toast.success(
        shouldRenderEditedTimeline
          ? `已按当前 ${renderedEvents.length} 个变体重新渲染`
          : '视频降重效果预览已生成',
      );
    } catch (error) {
      toast.error(`生成效果预览失败：${(error as Error).message}`);
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [
    currentPreviewSignature,
    elementScalePercent,
    enabledPositions,
    libraryScan,
    maxDuration,
    minDuration,
    minimumGap,
    overlaysPerVideo,
    scheduleMode,
    skipHead,
    skipTail,
    sourceVideos,
    toast,
    validateGreenElements,
  ]);

  const handleAddTasks = useCallback(async () => {
    if (sourceVideos.length === 0) {
      toast.warning('请先选择待处理视频');
      return;
    }
    if (!outputDir) {
      toast.warning('请先选择导出位置');
      return;
    }
    if (!libraryScan?.success || libraryScan.elements.length === 0) {
      toast.warning('请先设置包含可用内容的变体元素库');
      return;
    }
    if (minDuration > maxDuration) {
      toast.warning('最短持续时间不能大于最长持续时间');
      return;
    }

    setIsAddingTasks(true);
    try {
      const metadataEntries = await Promise.all(
        sourceVideos.map(async (sourcePath) => ({
          sourcePath,
          metadata: await window.api.getVideoMetadata(sourcePath),
        })),
      );
      const tasks: Task[] = [];
      let taskIndex = 0;

      for (const { sourcePath, metadata } of metadataEntries) {
        for (let variantIndex = 1; variantIndex <= copies; variantIndex += 1) {
          const randomSeed = createRandomSeed();
          const scheduleConfig = {
            eventCount: overlaysPerVideo,
            minDuration,
            maxDuration,
            skipHead,
            skipTail,
            minimumGap,
            scheduleMode,
            positions: enabledPositions,
            randomSeed,
          };
          const shouldUseCustomTimeline = hasCustomTimeline
            && sourcePath === sourceVideos[0]
            && variantIndex === 1
            && previewEvents.length > 0
            && Math.abs(metadata.duration - previewDuration) < 0.05
            && previewSignature === currentPreviewSignature;
          const events = shouldUseCustomTimeline
            ? previewEvents.map((event) => ({ ...event }))
            : buildVideoDedupSchedule(metadata.duration, libraryScan.elements, scheduleConfig);
          const usedPaths = new Set(events.map((event) => event.elementPath));
          const usedElements = libraryScan.elements.filter((element) => usedPaths.has(element.path));
          const config: VideoDedupTaskConfig = {
            ...scheduleConfig,
            elements: usedElements,
            events,
            variantIndex,
            elementScale: elementScalePercent / 100,
          };
          tasks.push({
            id: -(Date.now() + taskIndex),
            type: 'video_dedup',
            status: 'pending',
            name: `视频降重 · ${variantIndex}`,
            files: [{
              path: sourcePath,
              category: 'source',
              category_name: '原视频',
              index: 1,
            }],
            config: config as unknown as Record<string, unknown>,
            outputDir,
          });
          taskIndex += 1;
        }
      }

      const usedElements = tasks.flatMap((task) => {
        const config = task.config as unknown as VideoDedupTaskConfig;
        return config.elements || [];
      });
      await validateGreenElements(usedElements);

      const result = await batchCreateTasks(tasks);
      if (!result.success || result.successCount === 0) {
        throw new Error(result.error || result.errors?.[0]?.error || '任务创建失败');
      }
      setAddedTaskCount(result.successCount);
      setShowTaskAddedDialog(true);
      toast.success(`已添加 ${result.successCount} 个视频降重任务`);
      if (result.failCount > 0) {
        toast.warning(`${result.failCount} 个任务添加失败，请查看任务中心日志`);
      }
    } catch (error) {
      toast.error(`添加任务失败：${(error as Error).message}`);
    } finally {
      setIsAddingTasks(false);
    }
  }, [
    batchCreateTasks,
    copies,
    currentPreviewSignature,
    elementScalePercent,
    enabledPositions,
    hasCustomTimeline,
    libraryScan,
    maxDuration,
    minDuration,
    minimumGap,
    outputDir,
    overlaysPerVideo,
    previewDuration,
    previewEvents,
    previewSignature,
    scheduleMode,
    skipHead,
    skipTail,
    sourceVideos,
    toast,
    validateGreenElements,
  ]);

  return (
    <div
      data-testid="video-dedup-page"
      className={`${workspaceSkinClassName} h-screen flex flex-col ${
        isLightTheme ? 'theme-light-page bg-[#F8F8F5] text-[#222222]' : 'bg-[#181818] text-[#D1D1D1]'
      }`}
    >
      <PageHeader
        backPath="/"
        title="视频降重处理"
        icon={Shuffle}
        iconColor={isLightTheme ? 'text-rose-600' : 'text-rose-400'}
        description="批量生成视频变体，用于降低素材重复度"
        featureInfo={{
          title: '视频降重处理',
          description: '通过本地变体元素库，在视频时间轴中随机编排透明贴纸、GIF 或绿幕视频。',
          details: [
            '首版支持 PNG、GIF 和绿幕 MP4 变体元素',
            '默认采用均匀分布，元素事件在不同时间段内随机出现',
            '处理任务进入任务中心执行，支持进度、取消、失败重试与结果追踪',
          ],
          themeColor: 'rose',
        }}
        rightContent={
          <div className="flex items-center gap-2">
            <ModeSwitcher mode={workspaceMode} onChange={setWorkspaceMode} />
            {!isMetalSkin && (
              <PageThemeToggle isLightTheme={isLightTheme} onToggle={togglePageTheme} />
            )}
          </div>
        }
      />

      {workspaceMode === 'process' ? (
        <div className="flex min-h-0 flex-1 gap-2 p-2">
          <aside className="metal-sidebar w-[350px] shrink-0 overflow-y-auto rounded-xl border border-slate-800 bg-black/30 p-3">
            <div className="space-y-3">
              <FileSelectorGroup>
                <FileSelector
                  ref={sourceSelectorRef}
                  id="videoDedupSources"
                  name="待处理视频"
                  accept="video"
                  multiple
                  showList
                  minHeight={72}
                  maxHeight={180}
                  required
                  themeColor="rose"
                  onChange={setSourceVideos}
                />
              </FileSelectorGroup>

              <div className="metal-control rounded-xl border border-slate-800 bg-black/30 p-3">
                <SectionTitle
                  icon={SlidersHorizontal}
                  title="生成规则"
                  description="控制每条原视频生成多少变体，以及每条变体的元素密度。"
                />
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <NumberField
                    label="每条生成"
                    value={copies}
                    min={1}
                    max={20}
                    suffix="份"
                    onChange={setCopies}
                  />
                  <NumberField
                    label="出现次数"
                    value={overlaysPerVideo}
                    min={1}
                    max={30}
                    suffix="次"
                    onChange={setOverlaysPerVideo}
                  />
                  <NumberField
                    label="最短持续"
                    value={minDuration}
                    min={0.5}
                    max={30}
                    suffix="秒"
                    onChange={setMinDuration}
                  />
                  <NumberField
                    label="最长持续"
                    value={maxDuration}
                    min={0.5}
                    max={30}
                    suffix="秒"
                    onChange={setMaxDuration}
                  />
                </div>
              </div>

              <div className="metal-control rounded-xl border border-slate-800 bg-black/30 p-3">
                <SectionTitle
                  icon={Clock3}
                  title="元素分布"
                  description="控制变体元素在视频时间线中的出现位置与间隔。"
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {([
                    ['slots', '均匀分布', '分时段均匀出现'],
                    ['random', '随机分布', '全片随机且不重叠'],
                  ] as const).map(([id, title, description]) => (
                    <button
                      key={id}
                      type="button"
                      data-selected={scheduleMode === id}
                      onClick={() => setScheduleMode(id)}
                      className={`video-dedup-schedule-button rounded-lg border p-2.5 text-left transition-all ${
                        scheduleMode === id
                          ? 'border-[#FF385C] bg-[#FF385C] text-white'
                          : 'border-slate-800 bg-black/30 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="flex items-center justify-between text-xs font-bold">
                        {title}
                        {scheduleMode === id && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className="mt-1 block text-[10px] text-slate-500">{description}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <NumberField
                    label="跳过片头"
                    value={skipHead}
                    min={0}
                    max={60}
                    suffix="秒"
                    onChange={setSkipHead}
                  />
                  <NumberField
                    label="跳过片尾"
                    value={skipTail}
                    min={0}
                    max={60}
                    suffix="秒"
                    onChange={setSkipTail}
                  />
                  <div className="col-span-2">
                    <NumberField
                      label="元素最小间隔"
                      value={minimumGap}
                      min={0}
                      max={30}
                      step={0.01}
                      suffix="秒"
                      onChange={setMinimumGap}
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2.5">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
                  <div>
                    <p className="text-xs font-bold text-rose-400">单轨防重叠已固定开启</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
                      任意时间只出现一个变体元素，前后元素至少间隔 {minimumGap} 秒。
                    </p>
                  </div>
                </div>
              </div>

              <OutputDirSelector
                label="导出位置"
                value={outputDir}
                onChange={handleOutputDirChange}
                themeColor="rose"
              />
            </div>
          </aside>

          <main className="metal-workspace flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-black/25">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-slate-800 px-4">
              <div className="flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-rose-400" />
                <span className="text-sm font-bold text-slate-200">变体编排预览</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-slate-800 bg-black/30 px-2 py-1 text-[11px] text-slate-500">
                  {sourceVideos.length > 0 ? `${sourceVideos.length} 条视频` : '等待导入视频'}
                </span>
                <button
                  type="button"
                  data-testid="video-dedup-generate-preview"
                  onClick={handleGeneratePreview}
                  disabled={isGeneratingPreview || sourceVideos.length === 0 || !libraryScan?.elements.length}
                  className="metal-primary flex h-8 items-center gap-1.5 rounded-lg bg-[#FF385C] px-3 text-[11px] font-bold text-white transition-all hover:bg-[#e93252] disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                >
                  {isGeneratingPreview ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  {isGeneratingPreview
                    ? `${previewProgress}%`
                    : canRenderEditedTimeline
                      ? '重新渲染'
                      : previewUrl
                        ? '重新生成预览'
                        : '生成效果预览'}
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
              <div className="metal-canvas-shell relative flex min-h-[260px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-[#0E1629]">
                <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(148,163,184,.10)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,.10)_1px,transparent_1px)] [background-size:32px_32px]" />
                {previewUrl ? (
                  <>
                    <video
                      ref={previewVideoRef}
                      src={previewUrl}
                      controls
                      loop
                      onLoadedMetadata={handlePreviewLoadedMetadata}
                      className="relative z-10 h-full max-h-full w-full object-contain"
                    />
                    {isPreviewStale && (
                      <div className="absolute right-3 top-3 z-20 rounded-lg border border-amber-500/40 bg-amber-950/90 px-3 py-2 text-[11px] font-bold text-amber-300">
                        {canRenderEditedTimeline ? '时间轴已调整，请重新渲染' : '参数已经变化，请重新生成预览'}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="relative flex flex-col items-center text-center">
                    <span className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-700 bg-black/30 text-slate-500 shadow-2xl">
                      {isGeneratingPreview ? <RefreshCw className="h-9 w-9 animate-spin text-rose-400" /> : <Film className="h-9 w-9" />}
                    </span>
                    <p className="mt-4 text-sm font-bold text-slate-300">
                      {isGeneratingPreview ? previewStep || '正在生成真实效果预览' : '生成第一条视频的真实效果预览'}
                    </p>
                    <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
                      预览会实际执行元素排程、GIF循环和绿幕抠色，结果与任务中心处理规则一致。
                    </p>
                    <button
                      type="button"
                      onClick={handleGeneratePreview}
                      disabled={isGeneratingPreview || sourceVideos.length === 0 || !libraryScan?.elements.length}
                      className="metal-primary mt-4 flex h-9 items-center gap-2 rounded-lg bg-[#FF385C] px-4 text-xs font-bold text-white transition-all hover:bg-[#e93252] disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                    >
                      <Play className="h-3.5 w-3.5" />
                      生成效果预览
                    </button>
                    {isGeneratingPreview && (
                      <div className="mt-3 h-1.5 w-56 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full bg-rose-500 transition-all" style={{ width: `${previewProgress}%` }} />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-800 bg-black/30 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-300">
                      {previewDuration > 0 ? `${previewDuration.toFixed(1)} 秒实际排程时间轴` : '实际排程时间轴'}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {previewEvents.length > 0
                        ? isTimelineEdited
                          ? '时间轴已调整，点击右上角“重新渲染”查看修改后的效果'
                          : `${previewEvents.length} 次元素事件；拖动素材块调整位置，拖动两端可自由调整时长`
                        : '生成效果预览后显示真实元素与时间区间'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        data-testid="video-dedup-add-timeline-event"
                        onClick={handleAddTimelineEvent}
                        disabled={isGeneratingPreview || previewDuration <= 0 || !libraryScan?.elements.length}
                        className="video-dedup-timeline-action video-dedup-timeline-add flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Plus className="h-3 w-3" />
                        增加变体
                      </button>
                      <button
                        type="button"
                        data-testid="video-dedup-delete-timeline-event"
                        data-active={selectedTimelineEventIndex !== null}
                        aria-pressed={selectedTimelineEventIndex !== null}
                        onClick={handleDeleteSelectedTimelineEvent}
                        disabled={isGeneratingPreview || selectedTimelineEventIndex === null}
                        className={`video-dedup-timeline-action video-dedup-timeline-delete flex h-7 items-center gap-1 rounded-md border px-2 text-[10px] font-bold transition-all disabled:cursor-not-allowed ${
                          selectedTimelineEventIndex !== null ? 'metal-primary bg-[#FF385C] text-white' : ''
                        }`}
                      >
                        <Trash2 className="h-3 w-3" />
                        删除所选
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <span className="video-dedup-type-color h-2 w-2 rounded-sm" data-element-type="image" />
                        静态贴纸
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="video-dedup-type-color h-2 w-2 rounded-sm" data-element-type="gif" />
                        GIF
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="video-dedup-type-color h-2 w-2 rounded-sm" data-element-type="green_video" />
                        绿幕视频
                      </span>
                    </div>
                  </div>
                </div>
                <div
                  ref={timelineTrackRef}
                  data-testid="video-dedup-timeline-track"
                  data-duration={previewDuration}
                  className="relative h-14 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60"
                >
                  <div className="absolute inset-y-0 left-1/4 border-l border-dashed border-slate-700" />
                  <div className="absolute inset-y-0 left-1/2 border-l border-dashed border-slate-700" />
                  <div className="absolute inset-y-0 left-3/4 border-l border-dashed border-slate-700" />
                  {previewDuration > 0 && previewEvents.map((event, eventArrayIndex) => {
                    const left = Math.max(0, (event.start / previewDuration) * 100);
                    const width = Math.max(1.5, (event.duration / previewDuration) * 100);
                    const elementName = event.elementPath.split(/[/\\]/).pop() || `元素 ${event.index + 1}`;
                    return (
                      <div
                        key={`${event.index}-${event.elementPath}`}
                        role="button"
                        tabIndex={0}
                        data-testid={`video-dedup-timeline-event-${eventArrayIndex}`}
                        data-element-type={event.elementType}
                        data-start={event.start}
                        data-end={event.end}
                        className={`video-dedup-timeline-event absolute top-2 h-9 overflow-hidden text-[10px] leading-9 text-white ${
                          selectedTimelineEventIndex === eventArrayIndex ? 'video-dedup-timeline-event-selected' : ''
                        }`}
                        style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
                        title={`${elementName} · ${event.start.toFixed(1)}-${event.end.toFixed(1)} 秒`}
                        onPointerDown={(pointerEvent) => handleTimelinePointerDown(
                          pointerEvent,
                          eventArrayIndex,
                          'move',
                        )}
                      >
                        <span
                          data-testid={`video-dedup-timeline-resize-start-${eventArrayIndex}`}
                          className="video-dedup-timeline-resize-handle video-dedup-timeline-resize-start"
                          onPointerDown={(pointerEvent) => handleTimelinePointerDown(
                            pointerEvent,
                            eventArrayIndex,
                            'resize-start',
                          )}
                        />
                        <span className="block truncate px-3">{elementName} · {event.duration.toFixed(1)}s</span>
                        <span
                          data-testid={`video-dedup-timeline-resize-end-${eventArrayIndex}`}
                          className="video-dedup-timeline-resize-handle video-dedup-timeline-resize-end"
                          onPointerDown={(pointerEvent) => handleTimelinePointerDown(
                            pointerEvent,
                            eventArrayIndex,
                            'resize-end',
                          )}
                        />
                      </div>
                    );
                  })}
                  {previewEvents.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-600">
                      暂无排程
                    </div>
                  )}
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] text-slate-600">
                  <span>0s</span>
                  <span>{previewDuration > 0 ? `${(previewDuration / 2).toFixed(1)}s` : '--'}</span>
                  <span>{previewDuration > 0 ? `${previewDuration.toFixed(1)}s` : '--'}</span>
                </div>
                {selectedTimelineEvent && (
                  <div className="mt-2 flex items-center justify-between rounded-md border border-slate-800 bg-black/20 px-2.5 py-1.5 text-[10px]">
                    <span className="max-w-[65%] truncate text-slate-400">
                      当前：{selectedTimelineEvent.elementPath.split(/[/\\]/).pop() || `元素 ${selectedTimelineEvent.index + 1}`}
                    </span>
                    <span className="font-semibold text-slate-300">
                      {selectedTimelineEvent.start.toFixed(1)}–{selectedTimelineEvent.end.toFixed(1)}s · {selectedTimelineEvent.duration.toFixed(1)}s
                    </span>
                  </div>
                )}
                {previewEvents.length > 0 && (
                  <p className="mt-2 text-[10px] text-slate-500">
                    手动调整不受生成规则的最短/最长持续限制，仍会自动避开片头片尾与相邻元素。
                  </p>
                )}
                {hasCustomTimeline && !isTimelineEdited && (
                  <p className="mt-2 text-[10px] text-slate-500">
                    已保存手动编排：加入任务时应用于首条视频的第 1 个变体，其余变体继续按规则随机生成。
                  </p>
                )}
              </div>
            </div>
          </main>

          <aside className="metal-sidebar flex w-[300px] shrink-0 flex-col gap-3 overflow-y-auto rounded-xl border border-slate-800 bg-black/30 p-3">
            <div className="metal-control rounded-xl border border-slate-800 bg-black/30 p-3">
              <SectionTitle
                icon={Library}
                title="元素库状态"
                description="从固定本地目录随机抽取可用变体元素。"
              />
              <div className="mt-3 rounded-lg border border-dashed border-slate-700 bg-black/20 p-3 text-center">
                <FolderCog className="mx-auto h-6 w-6 text-slate-600" />
                <p className="mt-2 text-xs font-medium text-slate-400">
                  {isScanningLibrary
                    ? '正在扫描元素库...'
                    : libraryRoot
                      ? `已加载 ${libraryScan?.elements.length || 0} 个元素`
                      : '尚未设置元素库目录'}
                </p>
                <button
                  type="button"
                  onClick={() => setWorkspaceMode('library')}
                  className="mt-2 text-xs font-bold text-rose-400 hover:text-rose-300"
                >
                  前往元素库设置
                </button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  [ImageIcon, 'PNG', libraryScan?.counts.image || 0],
                  [Sticker, 'GIF', libraryScan?.counts.gif || 0],
                  [FileVideo2, '绿幕', libraryScan?.counts.green_video || 0],
                ].map(([Icon, label, count]) => {
                  const MaterialIcon = Icon as typeof ImageIcon;
                  return (
                    <div key={label as string} className="rounded-lg border border-slate-800 bg-black/25 p-2 text-center">
                      <MaterialIcon className="mx-auto h-4 w-4 text-slate-500" />
                      <p className="mt-1 text-[10px] text-slate-500">{label as string}</p>
                      <p className="mt-0.5 text-sm font-bold text-slate-300">{Number(count)}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="metal-control rounded-xl border border-slate-800 bg-black/30 p-3">
              <SectionTitle icon={MapPin} title="随机位置范围" />
              <div className="mt-3 grid grid-cols-2 gap-2">
                {([
                  ['top_left', '左上'],
                  ['top_right', '右上'],
                  ['bottom_left', '左下'],
                  ['bottom_right', '右下'],
                ] as const).map(([position, label]) => {
                  const enabled = enabledPositions.includes(position);
                  return (
                  <button
                    key={position}
                    type="button"
                    data-selected={enabled}
                    aria-pressed={enabled}
                    onClick={() => togglePosition(position)}
                    className={`video-dedup-position-button flex h-9 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition-all ${
                      enabled
                        ? 'border-[#FF385C] bg-[#FF385C] text-white'
                        : 'border-slate-800 bg-black/20 text-slate-600'
                    }`}
                  >
                    {enabled && <Check className="h-3 w-3" />}
                    {label}
                  </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[10px] leading-4 text-slate-500">首版默认启用四角安全区，后续可增加自由坐标与避让区域。</p>
            </div>

            <div className="metal-control rounded-xl border border-slate-800 bg-black/30 p-3">
              <SectionTitle
                icon={SlidersHorizontal}
                title="元素尺寸"
                description="按原视频宽度等比缩放，预览与正式导出保持一致。"
              />
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {([
                  ['小', 12],
                  ['中', 22],
                  ['大', 32],
                ] as const).map(([label, value]) => (
                  <button
                    key={value}
                    type="button"
                    data-selected={elementScalePercent === value}
                    onClick={() => handleElementScaleChange(value)}
                    className={`video-dedup-scale-button flex h-9 items-center justify-center rounded-lg border text-xs font-medium transition-all ${
                      elementScalePercent === value
                        ? 'border-[#FF385C] bg-[#FF385C] text-white'
                        : 'border-slate-800 bg-black/20 text-slate-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  data-selected={!ELEMENT_SCALE_PRESETS.includes(elementScalePercent as typeof ELEMENT_SCALE_PRESETS[number])}
                  onClick={() => handleElementScaleChange(CUSTOM_ELEMENT_SCALE_PERCENT)}
                  className={`video-dedup-scale-button flex h-9 items-center justify-center rounded-lg border text-xs font-medium transition-all ${
                    !ELEMENT_SCALE_PRESETS.includes(elementScalePercent as typeof ELEMENT_SCALE_PRESETS[number])
                      ? 'border-[#FF385C] bg-[#FF385C] text-white'
                      : 'border-slate-800 bg-black/20 text-slate-600'
                  }`}
                >
                  自定义
                </button>
              </div>
              <div className="mt-3 rounded-lg border border-slate-800 bg-black/20 px-3 py-2.5">
                <div className="mb-2 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">画面宽度占比</span>
                  <span className="video-dedup-scale-value rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 font-bold text-rose-400">
                    {elementScalePercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min={MIN_ELEMENT_SCALE_PERCENT}
                  max={MAX_ELEMENT_SCALE_PERCENT}
                  step={1}
                  value={elementScalePercent}
                  aria-label="元素尺寸"
                  data-testid="video-dedup-element-scale"
                  onChange={(event) => handleElementScaleChange(Number(event.target.value))}
                  className="video-dedup-scale-slider w-full"
                  style={{
                    '--video-dedup-scale-progress': `${elementScaleProgress}%`,
                  } as React.CSSProperties}
                />
                <div className="mt-1 flex justify-between text-[9px] text-slate-600">
                  <span>5%</span>
                  <span>50%</span>
                </div>
              </div>
            </div>

            <div className="mt-auto rounded-xl border border-slate-800 bg-black/35 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">预计输出</span>
                <span className="font-bold text-slate-200">{plannedOutputCount} 条</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500">每条出现</span>
                <span className="font-bold text-slate-200">{overlaysPerVideo} 次元素</span>
              </div>
              <button
                type="button"
                data-testid="video-dedup-add-tasks"
                onClick={handleAddTasks}
                disabled={isAddingTasks || plannedOutputCount === 0 || !outputDir || !libraryScan?.elements.length}
                className="metal-primary mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#FF385C] text-sm font-bold text-white transition-all hover:bg-[#e93252] disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
              >
                {isAddingTasks ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isAddingTasks ? '正在生成排程...' : '添加到任务中心'}
              </button>
            </div>
          </aside>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-2 p-2">
          <aside className="metal-sidebar w-[350px] shrink-0 overflow-y-auto rounded-xl border border-slate-800 bg-black/30 p-3">
            <div className="space-y-3">
              <div className="metal-control rounded-xl border border-slate-800 bg-black/30 p-3">
                <SectionTitle
                  icon={FolderCog}
                  title="本地变体元素库"
                  description="锚定一个固定根目录，软件按扩展名识别静态图片、GIF 与绿幕视频，不依赖文件夹名称。"
                />
                <div className="mt-3">
                  <OutputDirSelector
                    label="元素库根目录"
                    value={libraryRoot}
                    onChange={handleLibraryRootChange}
                    themeColor="rose"
                  />
                  <button
                    type="button"
                    data-testid="video-dedup-rescan-library"
                    onClick={() => void scanLibrary(libraryRoot, true)}
                    disabled={!libraryRoot || isScanningLibrary}
                    className="mt-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-800 bg-black/30 text-xs font-bold text-slate-400 transition-all hover:border-rose-500/40 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isScanningLibrary ? 'animate-spin' : ''}`} />
                    {isScanningLibrary ? '正在扫描...' : '重新扫描元素库'}
                  </button>
                </div>
              </div>

              <div className="metal-control rounded-xl border border-slate-800 bg-black/30 p-3">
                <SectionTitle icon={Boxes} title="推荐目录结构" />
                <div className="mt-3 space-y-2 font-mono text-xs">
                  {[
                    ['01_静态贴纸', 'PNG / WebP / JPG'],
                    ['02_GIF动态贴纸', 'GIF'],
                    ['03_绿幕视频', 'MP4 / MOV / M4V'],
                  ].map(([folder, format]) => (
                    <div key={folder} className="flex items-center justify-between rounded-lg border border-slate-800 bg-black/25 px-3 py-2.5">
                      <span className="text-slate-300">/{folder}</span>
                      <span className="text-[10px] text-slate-500">{format}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
                <p className="text-xs font-bold text-amber-400">元素准备建议</p>
                <p className="mt-1.5 text-[11px] leading-5 text-slate-400">
                  绿幕视频保留原始压缩格式即可；抠色参数由软件按元素保存，不要求设计师先导出超大的透明底视频。
                </p>
              </div>
            </div>
          </aside>

          <main className="metal-workspace flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-black/25">
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-800 px-4">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder="搜索元素名称或标签"
                  className="h-9 w-full rounded-lg border border-slate-800 bg-black/30 pl-9 pr-3 text-xs text-slate-200 outline-none focus:border-rose-500"
                />
              </div>
              <div className="flex items-center rounded-lg border border-slate-800 bg-black/30 p-1">
                {([
                  ['all', '全部'],
                  ['image', '静态'],
                  ['gif', 'GIF'],
                  ['green', '绿幕'],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMaterialFilter(id)}
                    className={`h-7 rounded-md px-3 text-[11px] font-bold transition-all ${
                      materialFilter === id ? 'bg-rose-500 text-white' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    icon: FileImage,
                    title: '静态贴纸',
                    formats: 'PNG / WebP / JPG',
                    count: libraryScan?.counts.image || 0,
                    description: '适合角标、装饰元素与轻量提示图形',
                    color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
                  },
                  {
                    icon: Sticker,
                    title: 'GIF 动态贴纸',
                    formats: 'GIF',
                    count: libraryScan?.counts.gif || 0,
                    description: '适合短循环动画与动态装饰效果',
                    color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
                  },
                  {
                    icon: FileVideo2,
                    title: '绿幕视频',
                    formats: 'MP4 / MOV / M4V',
                    count: libraryScan?.counts.green_video || 0,
                    description: '导入后使用独立抠色配方完成实时合成',
                    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                  },
                ].map(({ icon: Icon, title, formats, count, description, color }) => (
                  <div key={title} className="rounded-xl border border-slate-800 bg-black/30 p-4">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="mt-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-200">{title}</p>
                        <p className="mt-1 text-[10px] font-medium text-slate-500">{formats}</p>
                      </div>
                      <span className="rounded-md border border-slate-800 bg-black/30 px-2 py-1 text-[10px] text-slate-500">{count} 个</span>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500">{description}</p>
                    <div className="mt-4 flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-800 bg-black/20">
                      <span className="text-[11px] text-slate-600">
                        {libraryRoot ? `已扫描 ${count} 个，缩略图显示在下方列表` : '选择元素库目录后自动扫描'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {filteredElements.length > 0 ? (
                <div className="mt-3 space-y-3">
                  {displayedElementGroups.map((group) => {
                    const GroupIcon = group.icon;
                    return (
                      <section
                        key={group.type}
                        data-testid={`video-dedup-library-group-${group.type}`}
                        className="rounded-xl border border-slate-800 bg-black/15 p-3"
                      >
                        <div className="mb-2.5 flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${group.color}`}>
                              <GroupIcon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-xs font-bold text-slate-300">{group.title}</span>
                              <span className="mt-0.5 block text-[10px] text-slate-600">{group.formats}</span>
                            </span>
                          </div>
                          <span className="rounded-md border border-slate-800 bg-black/30 px-2 py-1 text-[10px] font-bold text-slate-500">
                            {group.count} 个
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                          {group.elements.map((element) => {
                            const isSelected = selectedElementPath === element.path;
                            return (
                              <button
                                key={element.path}
                                type="button"
                                onClick={() => setSelectedElementPath(element.path)}
                                className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                                  isSelected
                                    ? 'border-rose-500 bg-rose-500/10'
                                    : 'border-slate-800 bg-black/25 hover:border-slate-700'
                                }`}
                              >
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-900 text-slate-500">
                                  {elementThumbnails[element.path] ? (
                                    <img src={elementThumbnails[element.path]} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <GroupIcon className="h-5 w-5" />
                                  )}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs font-bold text-slate-300">{element.name}</span>
                                  <span className="mt-1 block text-[10px] text-slate-600">
                                    {(element.size / 1024 / 1024).toFixed(1)} MB
                                    {element.type === 'green_video' && !element.recipe ? ' · 缺少配方' : ''}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 flex min-h-[170px] items-center justify-center rounded-xl border border-dashed border-slate-800 bg-black/20 text-center">
                  <div>
                    <Grid2X2 className="mx-auto h-8 w-8 text-slate-700" />
                    <p className="mt-3 text-sm font-bold text-slate-400">
                      {isScanningLibrary ? '正在扫描元素库' : '暂无匹配元素'}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {libraryRoot ? '请检查目录内容或筛选条件' : '请先在左侧选择元素库根目录'}
                    </p>
                  </div>
                </div>
              )}
              {filteredElements.length > displayedElements.length && (
                <p className="mt-3 text-center text-[11px] text-slate-600">
                  当前显示前 {displayedElements.length} 个元素，可通过搜索继续定位其余 {filteredElements.length - displayedElements.length} 个
                </p>
              )}
            </div>
          </main>

          <aside className="metal-sidebar w-[310px] shrink-0 overflow-y-auto rounded-xl border border-slate-800 bg-black/30 p-3">
            <div className="metal-control rounded-xl border border-slate-800 bg-black/30 p-3">
              <SectionTitle
                icon={Sparkles}
                title="绿幕抠色配方"
                description="每个绿幕元素可保存一套独立参数。"
              />
              <div className="mt-4 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs text-slate-500">抠色基准色</span>
                  <span className="flex h-10 items-center gap-3 rounded-lg border border-slate-800 bg-black/30 px-3">
                    <input
                      type="color"
                      value={greenRecipe.keyColor}
                      onChange={(event) => setGreenRecipe((current) => ({ ...current, keyColor: event.target.value.toUpperCase() }))}
                      disabled={selectedElement?.type !== 'green_video'}
                      className="h-6 w-7 cursor-pointer border-0 bg-transparent p-0 disabled:cursor-not-allowed"
                    />
                    <span className="font-mono text-xs text-slate-300">{greenRecipe.keyColor}</span>
                  </span>
                </label>
                {([
                  ['相似度', 'similarity'],
                  ['边缘柔化', 'edgeSoftness'],
                  ['绿色溢出抑制', 'spillSuppression'],
                ] as const).map(([label, field]) => (
                  <label key={label} className="block">
                    <span className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                      <span>{label}</span><span>{greenRecipe[field]}%</span>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={greenRecipe[field]}
                      onChange={(event) => setGreenRecipe((current) => ({
                        ...current,
                        [field]: Number(event.target.value),
                      }))}
                      disabled={selectedElement?.type !== 'green_video'}
                      className="h-1.5 w-full accent-rose-500"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-slate-800 bg-[#0E1629] p-3">
                <div className="flex aspect-video items-center justify-center overflow-hidden rounded-md border border-slate-700 bg-[linear-gradient(45deg,#182238_25%,transparent_25%),linear-gradient(-45deg,#182238_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#182238_75%),linear-gradient(-45deg,transparent_75%,#182238_75%)] [background-position:0_0,0_8px,8px_-8px,-8px_0] [background-size:16px_16px]">
                  {greenPreview ? (
                    <img src={greenPreview} alt="绿幕抠色预览" className="h-full w-full object-contain" />
                  ) : isPreviewingGreen ? (
                    <RefreshCw className="h-6 w-6 animate-spin text-rose-400" />
                  ) : (
                    <Play className="h-7 w-7 text-slate-600" />
                  )}
                </div>
                <p className="mt-2 truncate text-center text-[10px] text-slate-600">
                  {selectedElement?.type === 'green_video' ? selectedElement.name : '请选择一个绿幕视频配置抠色参数'}
                </p>
                {greenPreviewError && (
                  <p className="mt-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[10px] leading-4 text-rose-400">
                    {greenPreviewError}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleSaveRecipe}
                disabled={selectedElement?.type !== 'green_video' || isSavingRecipe}
                className="mt-3 h-10 w-full rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs font-bold text-rose-400 transition-all hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-600"
              >
                {isSavingRecipe ? '正在保存...' : '保存元素配方'}
              </button>
            </div>

            <div className="mt-3 rounded-xl border border-slate-800 bg-black/30 p-3">
              <SectionTitle icon={Grid2X2} title="扫描摘要" />
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">可用元素</span><span className="font-bold text-slate-300">{libraryScan?.elements.length || 0}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">缺少配方</span><span className="font-bold text-amber-400">{libraryScan?.missingRecipes || 0}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">异常文件</span><span className="font-bold text-rose-400">{libraryScan?.errors.length || 0}</span></div>
              </div>
            </div>
          </aside>
        </div>
      )}

      <TaskAddedDialog
        open={showTaskAddedDialog}
        taskCount={addedTaskCount}
        onClear={() => {
          sourceSelectorRef.current?.clearFiles();
          setSourceVideos([]);
          setShowTaskAddedDialog(false);
        }}
        onKeep={() => setShowTaskAddedDialog(false)}
        onTaskCenter={() => navigate('/taskCenter')}
        clearLabel="清空已选视频"
      />
    </div>
  );
};

export default VideoDedupMode;
