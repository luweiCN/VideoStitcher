import React, { createContext, useContext } from "react";

export type ImageWorkshopMode = "standard" | "lossless" | "cover" | "overlay";

export type ImageWorkshopModeChangeGuard = (nextMode: ImageWorkshopMode) => boolean;

interface ImageWorkshopModeContextValue {
  mode: ImageWorkshopMode;
  setMode: (mode: ImageWorkshopMode) => void;
  registerModeChangeGuard: (guard: ImageWorkshopModeChangeGuard) => () => void;
}

const ImageWorkshopModeContext = createContext<ImageWorkshopModeContextValue | null>(null);

export const ImageWorkshopModeProvider = ImageWorkshopModeContext.Provider;

/** 获取工坊内部模式状态；旧独立入口下返回 null。 */
export const useImageWorkshopMode = () => useContext(ImageWorkshopModeContext);
