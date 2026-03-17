/**
 * 快速合成页面主组件
 * 显示待产库剧本列表,支持批量生成视频
 */

  import { useState, useEffect } from 'react';
  import { Sparkles, Play, X } from 'lucide-react';
  import { useASideStore } from '@renderer/stores/asideStore';
  import type { Screenplay, AIModel } from '@shared/types/aside';
  import { QuickComposeCard } from './QuickComposeCard';
  import { StepLayout } from '../StepLayout';

  /**
   * AI 模型选项
   */
  const MODEL_OPTIONS: { value: AIModel; label: string }[] = [
    { value: 'gemini', label: 'Gemini' },
    { value: 'doubao', label: '豆包' },
  { value: 'qwen', label: '通义千问' },
  { value: 'chatgpt', label: 'ChatGPT' },
  ];

  /**
   * 快速合成主组件
   */
  export function QuickCompose() {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [unifiedModel, setUnifiedModel] = useState<AIModel>('gemini');
    const [generatingStates, setGeneratingStates] = useState<Map<string, {
      isGenerating: boolean;
      progress: number;
    }>>(new Map());

    const [abortControllers, setAbortControllers] = useState<Map<string, AbortController>>(new Map());

    const {
      currentProject,
      libraryScripts,
      selectedModel,
      setLibraryScripts,
      updateLibraryScript,
      removeLibraryScript,
      setCurrentView,
      setModel,
    } = useASideStore();

    /**
     * 加载待产库剧本
     */
    const loadLibraryScreenplays = async () => {
      if (!currentProject) return;

      try {
        setIsLoading(true);
        setError(null);

        console.log('[QuickCompose] 加载待产库剧本，项目ID:', currentProject.id);

        const result = await window.api.asideGetLibraryScreenplays(currentProject.id);
        if (result.success && result.screenplays) {
          setLibraryScripts(result.screenplays);
          console.log('[QuickCompose] 加载成功,剧本数量:', result.screenplays.length);
        } else {
          throw new Error(result.error || '加载失败');
        }
      } catch (err) {
        console.error('[QuickCompose] 加载待产库失败:', err);
        setError('加载待产库失败,请稍后重试');
      } finally {
        setIsLoading(false);
      }
    };

    /**
     * 组件挂载时加载待产库
     */
    useEffect(() => {
      loadLibraryScreenplays();
    }, [currentProject?.id]);

    /**
     * 返回剧本生成页面
     */
    const handlePrev = () => {
      setCurrentView('step3-scripts');
    };

    /**
     * 更新单个剧本的模型
     */
    const handleModelChange = (screenplayId: string, model: AIModel) => {
      updateLibraryScript(screenplayId, { aiModel: model });
    };

    /**
     * 应用统一模型到所有剧本
     */
    const handleApplyUnifiedModel = () => {
      libraryScripts.forEach((screenplay) => {
        updateLibraryScript(screenplay.id, { aiModel: unifiedModel });
      });
      console.log('[QuickCompose] 已应用统一模型到所有剧本:', unifiedModel);
    };

    /**
     * 生成单个剧本的视频
     */
    const handleGenerate = async (screenplayId: string) => {
      const screenplay = libraryScripts.find((s) => s.id === screenplayId);
      if (!screenplay) return;

      // 创建 AbortController 用于取消生成
      const abortController = new AbortController();
      setAbortControllers((prev) => {
        const newMap = new Map(prev);
        newMap.set(screenplayId, abortController);
        return newMap;
      });

      try {
        // 更新状态为生成中
        setGeneratingStates((prev) => {
          const newMap = new Map(prev);
          newMap.set(screenplayId, { isGenerating: true, progress: 0 });
        return newMap;
      });

        // 更新剧本状态为生产中
        updateLibraryScript(screenplayId, { status: 'producing' });

        console.log('[QuickCompose] 开始生成视频,剧本ID:', screenplayId);
        // 模拟进度更新
        const progressInterval = setInterval(() => {
          setGeneratingStates((prev) => {
            const currentState = prev.get(screenplayId);
            if (!currentState || currentState.progress >= 90) {
              clearInterval(progressInterval);
              return prev;
            }
            const newMap = new Map(prev);
            newMap.set(screenplayId, {
              ...currentState,
              progress: currentState.progress + 10,
            });
            return newMap;
          });
        }, 500);
        // 调用视频生成 API
        const result = await window.api.asideGenerateVideoFromScreenplay(
          screenplayId,
          screenplay.aiModel || selectedModel
        );
        clearInterval(progressInterval);
        if (result.success) {
          // 更新剧本状态为已完成
          updateLibraryScript(screenplayId, {
            status: 'completed',
            videoUrl: result.videoUrl,
          });
          // 更新生成状态
          setGeneratingStates((prev) => {
            const newMap = new Map(prev);
            newMap.delete(screenplayId);
            return newMap;
          });
          // 移除 AbortController
          setAbortControllers((prev) => {
            const newMap = new Map(prev);
            newMap.delete(screenplayId);
            return newMap;
          });
          console.log('[QuickCompose] 视频生成完成:', result.videoUrl);
        } else {
          throw new Error(result.error || '生成失败');
        }
      } catch (err) {
        console.error('[QuickCompose] 生成视频失败:', err);
        // 恢复状态
        updateLibraryScript(screenplayId, { status: 'library' });
        setGeneratingStates((prev) => {
          const newMap = new Map(prev);
          newMap.delete(screenplayId);
          return newMap;
        });
        // 移除 AbortController
        setAbortControllers((prev) => {
          const newMap = new Map(prev);
          newMap.delete(screenplayId);
          return newMap;
        });
        setError(`生成视频失败: ${(err as Error).message}`);
      }
    };

    /**
     * 批量生成所有剧本的视频
     */
    const handleBatchGenerate = async () => {
      console.log('[QuickCompose] 开始批量生成,数量:', libraryScripts.length);
      for (const screenplay of libraryScripts) {
        await handleGenerate(screenplay.id);
      }
    };

    /**
     * 取消生成
     */
    const handleCancelGenerate = (screenplayId: string) => {
      const abortController = abortControllers.get(screenplayId);
      if (abortController) {
        // 中止生成过程
        abortController.abort();
        // 恢复状态
        updateLibraryScript(screenplayId, { status: 'library' });
        setGeneratingStates((prev) => {
          const newMap = new Map(prev);
          newMap.delete(screenplayId);
          return newMap;
        });
        // 移除 AbortController
        setAbortControllers((prev) => {
          const newMap = new Map(prev);
          newMap.delete(screenplayId);
          return newMap;
        });
        console.log('[QuickCompose] 已取消生成,剧本ID:', screenplayId);
      }
    };
    /**
     * 删除剧本
     */
    const handleDelete = async (screenplayId: string) => {
      const confirmed = window.confirm('确定从待产库中删除这个剧本吗?');
      if (!confirmed) return;
      try {
        // 更新剧本状态为草稿(移出待产库)
        const result = await window.api.asideUpdateScreenplayStatus(screenplayId, 'draft');
        if (result.success) {
          removeLibraryScript(screenplayId);
          console.log('[QuickCompose] 已删除剧本:', screenplayId);
        } else {
          throw new Error(result.error || '删除失败');
        }
      } catch (err) {
        console.error('[QuickCompose] 删除剧本失败:', err);
        setError(`删除失败: ${(err as Error).message}`);
      }
    };

    /**
     * 预览视频
     */
    const handlePreview = (screenplayId: string) => {
      const screenplay = libraryScripts.find((s) => s.id === screenplayId);
      if (!screenplay) return;
      // 打开预览模态框的逻辑在 QuickComposeCard 中实现
      console.log('[QuickCompose] 打开预览模态框,剧本ID:', screenplayId);
    };

    /**
     * 保存视频
     */
    const handleSave = async (screenplayId: string) => {
      const screenplay = libraryScripts.find((s) => s.id === screenplayId);
      if (!screenplay || !screenplay.videoUrl) {
        alert('视频尚未生成,无法保存');
        return;
      }

      try {
        // 打开文件保存对话框
        const result = await window.api.pickOutDir();
        if (!result) {
          console.log('[QuickCompose] 用户取消了保存');
          return;
        }

        console.log('[QuickCompose] 保存视频到目录:', result);
        // 这里需要调用保存视频的 API
        // 由于当前 API 中没有 asideSaveVideo,暂时使用 alert 提示
        alert(`视频保存功能开发中...\n保存路径: ${result}\n视频URL: ${screenplay.videoUrl}`);
      } catch (err) {
        console.error('[QuickCompose] 保存视频失败:', err);
        setError(`保存失败: ${(err as Error).message}`);
      }
    };

    // 加载状态
    if (isLoading) {
      return (
        <div className="h-full flex items-center justify-center bg-black text-slate-500">
          <div className="text-center">
            <Sparkles className="w-16 h-16 mx-auto mb-4 animate-pulse" />
            <p>加载中...</p>
          </div>
        </div>
      );
    }

    // 错误状态
    if (error) {
      return (
        <div className="h-full flex items-center justify-center bg-black text-slate-500">
          <div className="text-center">
            <p className="text-red-400 mb-2">{error}</p>
            <button
              onClick={loadLibraryScreenplays}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition-colors"
            >
              重试
            </button>
          </div>
        </div>
      );
    }

    // 空状态
    if (libraryScripts.length === 0) {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-black text-slate-500">
          <Sparkles className="w-16 h-16 mb-4" />
          <p className="mb-2">待产库为空</p>
          <p className="text-sm text-slate-600">请先生成剧本并添加到待产库</p>
          <button
            onClick={handlePrev}
            className="mt-6 px-4 py-2 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 transition-colors"
          >
            返回剧本生成
          </button>
        </div>
      );
    }

    return (
      <StepLayout
        title="快速合成"
        stepNumber={4}
        totalSteps={3}
        onPrev={handlePrev}
        nextButtons={
          <>
            <button
              onClick={() => setCurrentView('director-mode')}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-pink-600 to-violet-600 text-white rounded-lg hover:from-pink-700 hover:to-violet-700 transition-all"
            >
              <span>🎬 导演模式</span>
            </button>
          </>
        }
      >
        <div className="h-full flex flex-col bg-black text-slate-100 p-6">
          {/* 统一控制区 */}
          <div className="mb-6 p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-400">统一模型:</label>
                <select
                  value={unifiedModel}
                  onChange={(e) => setUnifiedModel(e.target.value as AIModel)}
                  aria-label="统一模型选择"
                  className="px-3 py-1.5 bg-black/50 border border-slate-800 rounded-lg text-slate-100 focus:outline-none focus:border-slate-700"
                >
                  {MODEL_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleApplyUnifiedModel}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
              >
                应用全部
              </button>

              <div className="flex-1" />

              <button
                onClick={handleBatchGenerate}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-pink-600 to-violet-600 text-white rounded-lg hover:from-pink-700 hover:to-violet-700 transition-all"
              >
                <Play className="w-4 h-4" />
                <span>批量生成全部</span>
              </button>
            </div>
          </div>

          {/* 剧本列表 */}
          <div className="flex-1 overflow-y-auto space-y-4">
            {libraryScripts.map((screenplay, index) => (
              <QuickComposeCard
                key={screenplay.id}
                screenplay={screenplay}
                index={index + 1}
                progress={generatingStates.get(screenplay.id)?.progress || 0}
                onModelChange={handleModelChange}
                onGenerate={handleGenerate}
                onCancelGenerate={handleCancelGenerate}
                onDelete={handleDelete}
                onPreview={handlePreview}
                onSave={handleSave}
              />
            ))}
          </div>
        </div>
      </StepLayout>
    );
  }
