/**
 * 加载图片为 HTMLImageElement
 * @param imagePath 图片路径
 * @returns 加载成功返回 HTMLImageElement，否则返回 null
 */
export const loadImageAsElement = async (imagePath: string): Promise<HTMLImageElement | null> => {
  try {
    const result = await window.api.getPreviewUrl(imagePath);
    if (result.success && result.url) {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = result.url!;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
      });
    }
    return null;
  } catch {
    return null;
  }
};
