import React from "react";
import { ArrowRight } from "lucide-react";

/**
 * 图片文件类型
 */
interface ImageFile {
  path: string;
  name: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  orientation?: string;
  aspectRatio?: string;
}

/**
 * 获取目标尺寸
 */
function getTargetSize(file: ImageFile): { width: number; height: number } {
  const orientation = file.orientation;
  if (orientation === "landscape") {
    return { width: 1920, height: 1080 };
  } else if (orientation === "portrait") {
    return { width: 1080, height: 1920 };
  } else {
    return { width: 800, height: 800 };
  }
}

/**
 * 获取变形程度提示
 */
function getDeformationLevel(
  file: ImageFile,
): { text: string; color: string } {
  if (!file.width || !file.height) {
    return { text: "未知", color: "text-slate-500" };
  }

  const sourceRatio = file.width / file.height;
  const target = getTargetSize(file);
  const targetRatio = target.width / target.height;

  const ratioDiff = Math.abs(sourceRatio - targetRatio) / targetRatio;
  const percentDiff = ratioDiff * 100;

  if (percentDiff < 1) {
    return { text: "不会变形", color: "text-emerald-400" };
  } else if (percentDiff < 15) {
    return { text: "轻微变形", color: "text-amber-400" };
  } else {
    return { text: "会变形", color: "text-rose-400" };
  }
}

interface CoverPreviewProps {
  file: ImageFile | null;
  themeColor?: string;
}

const CoverPreview: React.FC<CoverPreviewProps> = ({
  file,
  themeColor = "fuchsia",
}) => {
  if (!file || !file.thumbnailUrl) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 border-t border-slate-800">
        <p className="text-xs">暂无预览</p>
      </div>
    );
  }

  const targetSize = getTargetSize(file);
  const deformation = getDeformationLevel(file);

  return (
    <div className="flex-1 border-t border-slate-800 bg-black/30 shrink-0 flex flex-col items-center justify-center">
      <div className="flex items-center gap-12">
        {/* 左边：原图 */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
            原图 ({file.aspectRatio || ""})
          </span>
          <img
            src={file.thumbnailUrl}
            alt={file.name}
            className="h-64 w-auto object-contain"
          />
          <span className="text-[10px] text-slate-500 mt-2">
            {file.width}×{file.height}
          </span>
        </div>

        {/* 中间箭头 */}
        <div className="flex flex-col items-center">
          <ArrowRight className={`w-14 h-14 text-${themeColor}-400`} />
          <span className={`text-[10px] mt-2 ${deformation.color}`}>
            {deformation.text}
          </span>
        </div>

        {/* 右边：目标效果 */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
            目标 (
            {file.orientation === "landscape"
              ? "16:9"
              : file.orientation === "portrait"
                ? "9:16"
                : "1:1"}
            )
          </span>
          <div
            className={`
              relative overflow-hidden rounded-lg border border-slate-700/50
              ${
                file.orientation === "portrait"
                  ? "w-36 h-64"
                  : file.orientation === "landscape"
                    ? "w-64 h-36"
                    : "w-48 h-48"
              }
            `}
          >
            <img
              src={file.thumbnailUrl}
              alt="目标效果"
              className="absolute inset-0 w-full h-full object-fill"
            />
          </div>
          <span className="text-[10px] text-slate-500 mt-2">
            {targetSize.width}×{targetSize.height}
          </span>
        </div>
      </div>
    </div>
  );
};

export { getTargetSize, getDeformationLevel };
export type { ImageFile };
export default CoverPreview;
