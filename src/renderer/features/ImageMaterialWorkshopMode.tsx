import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ImageMaterialMode from "./ImageMaterialMode";
import LosslessGridMode from "./LosslessGridMode";
import CoverToolboxMode from "./CoverToolboxMode";
import OverlayGeneratorMode from "@/features/OverlayGeneratorMode";
import {
  ImageWorkshopModeProvider,
  type ImageWorkshopModeChangeGuard,
  type ImageWorkshopMode,
} from "./ImageWorkshopModeContext";

/**
 * 图片素材工坊统一入口。
 *
 * 各模式在页面和任务链路上保持隔离：
 * - standard：标准素材生产，使用 image_material 任务
 * - lossless：专业切片模式，使用 lossless_grid 任务
 * - cover：封面工具
 * - overlay：贴片生成器，使用 overlay_generator 任务
 */
const ImageMaterialWorkshopMode: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedMode = searchParams.get("mode");
  const initialMode: ImageWorkshopMode =
    requestedMode === "lossless" || requestedMode === "cover" || requestedMode === "overlay"
      ? requestedMode
      : "standard";
  const [mode, setModeState] = useState<ImageWorkshopMode>(initialMode);
  const modeChangeGuardRef = useRef<ImageWorkshopModeChangeGuard | null>(null);

  useEffect(() => {
    setModeState(initialMode);
  }, [initialMode]);

  const registerModeChangeGuard = useCallback((guard: ImageWorkshopModeChangeGuard) => {
    modeChangeGuardRef.current = guard;
    return () => {
      if (modeChangeGuardRef.current === guard) modeChangeGuardRef.current = null;
    };
  }, []);

  const setMode = useCallback((nextMode: ImageWorkshopMode) => {
    if (nextMode === mode) return;
    if (modeChangeGuardRef.current && !modeChangeGuardRef.current(nextMode)) return;

    setModeState(nextMode);
    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextMode === "standard") nextSearchParams.delete("mode");
    else nextSearchParams.set("mode", nextMode);
    setSearchParams(nextSearchParams, { replace: true });
  }, [mode, searchParams, setSearchParams]);

  let content: React.ReactNode;

  if (mode === "lossless") {
    content = <LosslessGridMode />;
  } else if (mode === "cover") {
    content = <CoverToolboxMode />;
  } else if (mode === "overlay") {
    content = <OverlayGeneratorMode />;
  } else {
    content = <ImageMaterialMode />;
  }

  return (
    <ImageWorkshopModeProvider value={{ mode, setMode, registerModeChangeGuard }}>
      {content}
    </ImageWorkshopModeProvider>
  );
};

export default ImageMaterialWorkshopMode;
