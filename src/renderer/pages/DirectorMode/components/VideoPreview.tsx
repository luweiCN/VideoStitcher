/**
 * 视频预览 - 最终视频播放和导出
 */

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize } from 'lucide-react';
import type { Scene } from '../types';

interface VideoPreviewProps {
  storyboard: Scene[];
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ storyboard }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // 计算总时长
  const totalDuration = storyboard.reduce((sum, scene) => sum + scene.duration, 0);

  // 播放/暂停
  const togglePlay = () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }

    setIsPlaying(!isPlaying);
  };

  // 静音切换
  const toggleMute = () => {
    if (!videoRef.current) return;

    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // 全屏
  const toggleFullscreen = () => {
    if (!videoRef.current) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoRef.current.requestFullscreen();
    }
  };

  // 更新进度
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 进度条点击
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;

    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      {/* 视频容器 */}
      <div className="w-full max-w-5xl">
        {/* 视频播放器 */}
        <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800">
          {storyboard[0]?.videoUrl ? (
            <video
              ref={videoRef}
              src={storyboard[0].videoUrl}
              className="w-full h-full object-contain"
              onClick={togglePlay}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-600/10 to-teal-600/10">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                <Play className="w-10 h-10 text-emerald-400" />
              </div>
              <p className="text-slate-400 text-sm">视频预览将在这里显示</p>
              <p className="text-slate-500 text-xs mt-2">
                总时长: {formatTime(totalDuration)}
              </p>
            </div>
          )}

          {/* 播放按钮覆盖层 */}
          {storyboard[0]?.videoUrl && !isPlaying && (
            <div
              className="absolute inset-0 flex items-center justify-center bg-black/20 cursor-pointer"
              onClick={togglePlay}
            >
              <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                <Play className="w-8 h-8 text-slate-900 ml-1" />
              </div>
            </div>
          )}
        </div>

        {/* 控制栏 */}
        <div className="mt-4 bg-slate-900/50 rounded-lg p-4 border border-slate-800">
          {/* 进度条 */}
          <div
            className="h-2 bg-slate-800 rounded-full overflow-hidden cursor-pointer mb-3"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>

          {/* 控制按钮 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* 播放/暂停 */}
              <button
                onClick={togglePlay}
                className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </button>

              {/* 静音 */}
              <button
                onClick={toggleMute}
                className="p-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>

              {/* 时间显示 */}
              <span className="text-sm text-slate-400">
                {formatTime(currentTime)} / {formatTime(duration || totalDuration)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* 全屏 */}
              <button
                onClick={toggleFullscreen}
                className="p-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <Maximize className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* 分镜缩略图列表 */}
        <div className="mt-6">
          <h3 className="text-sm font-medium text-slate-400 mb-3">场景列表</h3>
          <div className="grid grid-cols-5 gap-2">
            {storyboard.map((scene, index) => (
              <div
                key={scene.id}
                className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden border border-slate-800 hover:border-emerald-500/50 transition-colors cursor-pointer"
              >
                {scene.imageUrl ? (
                  <img
                    src={scene.imageUrl}
                    alt={`场景 ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900" />
                )}
                <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded text-xs text-white">
                  {scene.duration}s
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
