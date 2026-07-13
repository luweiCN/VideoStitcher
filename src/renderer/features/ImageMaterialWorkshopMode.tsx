import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import ImageMaterialMode from "./ImageMaterialMode";
import LosslessGridMode from "./LosslessGridMode";
import CoverToolboxMode from "./CoverToolboxMode";
import {
  ImageWorkshopModeProvider,
  type ImageWorkshopMode,
} from "./ImageWorkshopModeContext";

/**
 * 图片素材工坊统一入口。
 *
 * 两种模式在页面和任务链路上保持隔离：
 * - standard：标准素材生产，使用 image_material 任务
 * - lossless：专业切片模式，使用 lossless_grid 任务
 */
const ImageMaterialWorkshopMode: React.FC = () => {
  const [searchParams] = useSearchParams();
  const requestedMode = searchParams.get("mode");
  const initialMode: ImageWorkshopMode =
    requestedMode === "lossless" || requestedMode === "cover"
      ? requestedMode
      : "standard";
  const [mode, setMode] = useState<ImageWorkshopMode>(initialMode);

  let content: React.ReactNode;

  if (mode === "lossless") {
    content = <LosslessGridMode />;
  } else if (mode === "cover") {
    content = <CoverToolboxMode />;
  } else {
    content = <ImageMaterialMode />;
  }

  return (
    <ImageWorkshopModeProvider value={{ mode, setMode }}>
      {content}
    </ImageWorkshopModeProvider>
  );
};

export default ImageMaterialWorkshopMode;
