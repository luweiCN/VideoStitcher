/**
 * 并发控制组件 - 紧凑版 + 实时系统监控
 */

import React, { useState, useEffect } from 'react';
import { Cpu, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { useTaskContext } from '@renderer/contexts/TaskContext';

interface SystemStats {
  cpu: {
    usage: number;
    cores: number[];
  };
  memory: {
    usedPercent: number;
    usedGB: string;
    totalGB: string;
  };
}

const ConcurrencyControl: React.FC = () => {
  const { config, setConcurrency, getCpuInfo } = useTaskContext();
  const [cpuCores, setCpuCores] = useState(8);
  const [localMaxTasks, setLocalMaxTasks] = useState(config?.maxConcurrentTasks || 2);
  const [localThreads, setLocalThreads] = useState(config?.threadsPerTask || 4);
  const [showCores, setShowCores] = useState(false);
  const [systemStats, setSystemStats] = useState<SystemStats>({
    cpu: { usage: 0, cores: [] },
    memory: { usedPercent: 0, usedGB: '0', totalGB: '0' },
  });

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

  useEffect(() => {
    const fetchSystemStats = async () => {
      try {
        const stats = await window.api.getSystemStats();
        setSystemStats(stats);
      } catch (err) {
        console.error('[ConcurrencyControl] 获取系统状态失败:', err);
      }
    };

    fetchSystemStats();
    const interval = setInterval(fetchSystemStats, 2000);
    return () => clearInterval(interval);
  }, []);

  const totalThreads = localMaxTasks * localThreads;
  const isOverloaded = totalThreads > cpuCores;

  const handleMaxTasksChange = async (value: number) => {
    setLocalMaxTasks(value);
    await setConcurrency(value, localThreads);
  };

  const handleThreadsChange = async (value: number) => {
    setLocalThreads(value);
    await setConcurrency(localMaxTasks, value);
  };

  const getCpuColor = (usage: number) => {
    if (usage >= 80) return 'bg-rose-500';
    if (usage >= 60) return 'bg-amber-500';
    if (usage >= 40) return 'bg-yellow-500';
    return 'bg-emerald-500';
  };

  const getCpuTextColor = (usage: number) => {
    if (usage >= 80) return 'text-rose-400';
    if (usage >= 60) return 'text-amber-400';
    return 'text-emerald-400';
  };

  return (
    <div className="space-y-3">
      {/* 主控制行 */}
      <div className="flex items-center gap-3 p-3 bg-black/50 border border-slate-800 rounded-xl">
        <Cpu className="w-4 h-4 text-slate-400 flex-shrink-0" />

        <div className="flex items-center gap-6 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">并发任务</span>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={localMaxTasks}
              onChange={(e) => handleMaxTasksChange(Number(e.target.value))}
              className="w-20 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
            />
            <span className="text-xs text-violet-400 font-medium w-4">{localMaxTasks}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">线程/任务</span>
            <input
              type="range"
              min={1}
              max={16}
              step={1}
              value={localThreads}
              onChange={(e) => handleThreadsChange(Number(e.target.value))}
              className="w-20 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <span className="text-xs text-cyan-400 font-medium w-4">{localThreads}</span>
          </div>

          {isOverloaded && (
            <span className="text-xs text-amber-400">⚠ {totalThreads}/{cpuCores} 核心</span>
          )}
        </div>

        {/* 系统状态快捷显示 */}
        <button
          onClick={() => setShowCores(!showCores)}
          className="flex items-center gap-3 pl-3 border-l border-slate-800 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs text-slate-400">CPU</span>
            <span className={`text-xs font-medium ${getCpuTextColor(systemStats.cpu.usage)}`}>
              {systemStats.cpu.usage}%
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">内存</span>
            <span className={`text-xs font-medium ${getCpuTextColor(systemStats.memory.usedPercent)}`}>
              {systemStats.memory.usedGB}/{systemStats.memory.totalGB}
            </span>
          </div>
          {showCores ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          )}
        </button>
      </div>

      {/* 各核心 CPU 占用率详情 */}
      {showCores && systemStats.cpu.cores.length > 0 && (
        <div className="p-3 bg-black/30 border border-slate-800 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">各核心 CPU 占用率</span>
            <span className="text-xs text-slate-500">{systemStats.cpu.cores.length} 核心</span>
          </div>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(systemStats.cpu.cores.length, 8)}, 1fr)` }}>
            {systemStats.cpu.cores.map((usage, index) => (
              <div key={index} className="flex flex-col items-center">
                <div className="w-full h-12 bg-slate-800 rounded relative overflow-hidden">
                  <div
                    className={`absolute bottom-0 left-0 right-0 transition-all duration-500 ${getCpuColor(usage)}`}
                    style={{ height: `${usage}%` }}
                  />
                </div>
                <span className={`text-[10px] mt-1 font-medium ${getCpuTextColor(usage)}`}>
                  {usage}%
                </span>
                <span className="text-[9px] text-slate-600">C{index}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConcurrencyControl;
