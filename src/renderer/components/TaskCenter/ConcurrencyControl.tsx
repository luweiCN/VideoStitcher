/**
 * 并发控制组件
 */

import React, { useState, useEffect } from 'react';
import { Cpu, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { useTaskContext } from '@renderer/contexts/TaskContext';
import { Button } from '@renderer/components/Button/Button';

interface ConcurrencyControlProps {
  compact?: boolean;
}

const ConcurrencyControl: React.FC<ConcurrencyControlProps> = ({ compact = false }) => {
  const { config, setConcurrency, getCpuInfo } = useTaskContext();
  const [expanded, setExpanded] = useState(!compact);
  const [cpuCores, setCpuCores] = useState(8);
  const [localMaxTasks, setLocalMaxTasks] = useState(config?.maxConcurrentTasks || 2);
  const [localThreads, setLocalThreads] = useState(config?.threadsPerTask || 4);

  useEffect(() => {
    getCpuInfo().then((info) => {
      setCpuCores(info.cores);
    });
  }, [getCpuInfo]);

  useEffect(() => {
    if (config) {
      setLocalMaxTasks(config.maxConcurrentTasks);
      setLocalThreads(config.threadsPerTask);
    }
  }, [config]);

  const totalThreads = localMaxTasks * localThreads;
  const isOverloaded = totalThreads > cpuCores;

  const handleApply = async () => {
    await setConcurrency(localMaxTasks, localThreads);
    if (compact) {
      setExpanded(false);
    }
  };

  const handleReset = () => {
    const recommendedTasks = Math.max(1, Math.floor(cpuCores / 4));
    const recommendedThreads = Math.max(1, Math.floor((cpuCores - 1) / recommendedTasks));
    setLocalMaxTasks(recommendedTasks);
    setLocalThreads(recommendedThreads);
  };

  if (compact && !expanded) {
    return (
      <div
        className="flex items-center gap-3 px-3 py-2 bg-slate-800/50 rounded-lg cursor-pointer hover:bg-slate-800/70 transition-colors"
        onClick={() => setExpanded(true)}
      >
        <span className="text-xs text-slate-400">并发:</span>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-violet-400 font-medium">{localMaxTasks}</span>
          <span className="text-slate-500">任务</span>
          <span className="text-slate-600 mx-1">·</span>
          <span className="text-cyan-400 font-medium">{localThreads}</span>
          <span className="text-slate-500">线程/任务</span>
        </div>
        {isOverloaded && <span className="text-xs text-amber-400">⚠</span>}
        <Settings className="w-3.5 h-3.5 text-slate-500 ml-auto" />
      </div>
    );
  }

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
      {/* 标题栏 */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-slate-800/50 cursor-pointer"
        onClick={() => compact && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-white">并发控制</span>
        </div>
        {compact && (
          expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </div>

      {/* 内容区 */}
      {expanded && (
        <div className="p-4 space-y-5">
          {/* CPU 信息 */}
          <div
            className={`p-3 rounded-lg ${
              isOverloaded
                ? 'bg-amber-500/10 border border-amber-500/30'
                : 'bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-300">
                检测到 <span className="font-medium text-white">{cpuCores}</span> 个 CPU 核心
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              预计线程使用: {totalThreads} 个
              {isOverloaded && (
                <span className="text-amber-400 ml-2">
                  ⚠ 超过 CPU 核心数，可能影响性能
                </span>
              )}
            </p>
          </div>

          {/* 同时执行任务数 */}
          <div>
            <label className="text-sm text-slate-300 mb-2 block">同时执行任务数</label>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={localMaxTasks}
              onChange={(e) => setLocalMaxTasks(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>1</span>
              <span className="text-violet-400">当前: {localMaxTasks} 个任务</span>
              <span>8</span>
            </div>
          </div>

          {/* 每个任务线程数 */}
          <div>
            <label className="text-sm text-slate-300 mb-2 block">每个任务使用线程数</label>
            <input
              type="range"
              min={1}
              max={16}
              step={1}
              value={localThreads}
              onChange={(e) => setLocalThreads(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>1</span>
              <span className="text-cyan-400">当前: {localThreads} 线程</span>
              <span>16</span>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-3 pt-2">
            <Button variant="ghost" size="sm" onClick={handleReset}>
              恢复默认
            </Button>
            <Button variant="primary" size="sm" onClick={handleApply} className="ml-auto">
              应用
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConcurrencyControl;
