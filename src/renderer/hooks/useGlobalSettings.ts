import { useState, useEffect, useCallback, useRef } from 'react';

interface GlobalSettings {
  defaultOutputDir: string;
  defaultConcurrency: number;
}

interface UseGlobalSettingsResult {
  globalSettings: GlobalSettings;
  setGlobalSettings: React.Dispatch<React.SetStateAction<GlobalSettings>>;
  savedSettings: GlobalSettings | null;
  isSaving: boolean;
  isDirty: boolean;
  hasChanges: boolean;
  saveSettings: () => Promise<void>;
  resetToSaved: () => void;
}

/**
 * 全局配置管理 Hook
 *
 * 功能：
 * 1. 初始化时从存储读取值作为应用状态和已保存状态
 * 2. 比较当前值和已保存值，只在有变化时标记为"有未保存的设置"
 * 3. 提供保存、重置等功能
 */
export function useGlobalSettings(): UseGlobalSettingsResult {
  // 应用当前状态
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    defaultOutputDir: '',
    defaultConcurrency: 3
  });

  // 从存储中读取的已保存值（用于比较是否有变化）
  const [savedSettings, setSavedSettings] = useState<GlobalSettings | null>(null);

  // 保存状态
  const [isSaving, setIsSaving] = useState(false);

  // 是否有未保存的修改
  const isDirty = savedSettings !== null && (
    globalSettings.defaultOutputDir !== savedSettings.defaultOutputDir ||
    globalSettings.defaultConcurrency !== savedSettings.defaultConcurrency
  );

  // 是否显示"有未保存的设置"（保存失败或正在保存时不显示）
  const hasChanges = isDirty && !isSaving;

  // 初始化：从存储读取配置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await window.api.getGlobalSettings();
        if (result && result.success && result.settings) {
          const settings = result.settings;
          // 同时设置应用状态和已保存状态
          setGlobalSettings({
            defaultOutputDir: settings.defaultOutputDir || '',
            defaultConcurrency: settings.defaultConcurrency || 3
          });
          setSavedSettings({
            defaultOutputDir: settings.defaultOutputDir || '',
            defaultConcurrency: settings.defaultConcurrency || 3
          });
        } else {
          // 没有保存的配置，使用默认值
          const defaults = {
            defaultOutputDir: '',
            defaultConcurrency: 3
          };
          setGlobalSettings(defaults);
          setSavedSettings(defaults);
        }
      } catch (err) {
        console.error('加载全局配置失败:', err);
        // 使用默认值
        const defaults = {
          defaultOutputDir: '',
          defaultConcurrency: 3
        };
        setGlobalSettings(defaults);
        setSavedSettings(defaults);
      }
    };

    loadSettings();
  }, []);

  // 保存配置
  const saveSettings = useCallback(async () => {
    if (savedSettings === null) {
      return;
    }

    setIsSaving(true);

    try {
      const result = await window.api.setGlobalSettings(globalSettings);
      if (result.success) {
        // 更新已保存状态
        setSavedSettings({ ...globalSettings });
      } else {
        alert(`保存失败: ${result.error}`);
      }
    } catch (err: any) {
      alert(`保存失败: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [globalSettings, savedSettings]);

  // 重置到已保存的值
  const resetToSaved = useCallback(() => {
    if (savedSettings !== null) {
      setGlobalSettings({ ...savedSettings });
    }
  }, [savedSettings]);

  return {
    globalSettings,
    setGlobalSettings,
    savedSettings,
    isSaving,
    isDirty,
    hasChanges,
    saveSettings,
    resetToSaved
  };
}
