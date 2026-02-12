# FileSelector 组件使用示例

## 基础用法

```tsx
import { FileSelector, FileSelectorGroup } from '@/components/FileSelector';

function MyFeature() {
  const [bVideos, setBVideos] = useState<string[]>([]);
  const [aVideos, setAVideos] = useState<string[]>([]);
  const [covers, setCovers] = useState<string[]>([]);

  return (
    <FileSelectorGroup>
      {/* B面视频 - 多选 */}
      <FileSelector
        id="bVideo"
        name="B面视频 (必选)"
        accept="video"
        multiple
        themeColor="violet"
        onChange={setBVideos}
      />

      {/* A面视频 - 多选 */}
      <FileSelector
        id="aVideo"
        name="A面视频 (可选)"
        accept="video"
        multiple
        themeColor="violet"
        onChange={setAVideos}
      />

      {/* 封面图 - 多选 */}
      <FileSelector
        id="cover"
        name="封面图 (可选)"
        accept="image"
        multiple
        themeColor="violet"
        onChange={setCovers}
      />
    </FileSelectorGroup>
  );
}
```

## 完整示例 - 视频合成模块

```tsx
import React, { useState } from 'react';
import { FileSelector, FileSelectorGroup } from '@/components/FileSelector';
import { Play } from 'lucide-react';

const VideoMergeExample: React.FC = () => {
  const [bVideos, setBVideos] = useState<string[]>([]);
  const [aVideos, setAVideos] = useState<string[]>([]);
  const [covers, setCovers] = useState<string[]>([]);
  const [bgImage, setBgImage] = useState<string[]>([]);

  const handleProcess = async () => {
    // 处理视频合成逻辑
    console.log('B面视频:', bVideos);
    console.log('A面视频:', aVideos);
    console.log('封面图:', covers);
    console.log('背景图:', bgImage);

    await window.api.videoHorizontalMerge({
      bVideos,
      aVideos: aVideos.length > 0 ? aVideos : undefined,
      coverImages: covers.length > 0 ? covers : undefined,
      bgImage: bgImage[0],
      outputDir: '/path/to/output',
      concurrency: 3
    });
  };

  const canProcess = bVideos.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* 标题 */}
        <div>
          <h1 className="text-2xl font-bold text-slate-200 mb-2">
            视频合成
          </h1>
          <p className="text-slate-500">
            支持粘贴文件，系统会自动识别并分配到对应的选择器
          </p>
        </div>

        {/* 文件选择器组 */}
        <FileSelectorGroup>
          <div className="space-y-6">
            {/* B面视频 - 必选 */}
            <FileSelector
              id="bVideo"
              name="B面视频 (必选)"
              accept="video"
              multiple
              showList
              minHeight={140}
              maxHeight={320}
              themeColor="violet"
              directoryCache
              onChange={setBVideos}
            />

            {/* A面视频 - 可选 */}
            <FileSelector
              id="aVideo"
              name="A面视频 (可选)"
              accept="video"
              multiple
              showList
              minHeight={100}
              maxHeight={200}
              themeColor="violet"
              directoryCache
              onChange={setAVideos}
            />

            {/* 背景图 - 单选 */}
            <FileSelector
              id="bgImage"
              name="背景图 (可选，单选)"
              accept="image"
              multiple={false}
              showList
              minHeight={80}
              maxHeight={160}
              themeColor="violet"
              directoryCache
              onChange={setBgImage}
            />

            {/* 封面图 - 多选 */}
            <FileSelector
              id="cover"
              name="封面图 (可选)"
              accept="image"
              multiple
              showList
              minHeight={100}
              maxHeight={200}
              themeColor="violet"
              directoryCache
              onChange={setCovers}
            />
          </div>
        </FileSelectorGroup>

        {/* 处理按钮 */}
        <div className="pt-4 border-t border-slate-800">
          <button
            onClick={handleProcess}
            disabled={!canProcess}
            className="w-full py-4 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 rounded-xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-violet-900/20 disabled:shadow-none"
          >
            <Play className="w-5 h-5 fill-current" />
            开始合成处理
          </button>
          {!canProcess && (
            <p className="text-center text-sm text-slate-600 mt-3">
              请至少选择 B 面视频
            </p>
          )}
        </div>

        {/* 状态显示 */}
        {(bVideos.length > 0 || aVideos.length > 0 || covers.length > 0 || bgImage.length > 0) && (
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
            <h3 className="text-sm font-semibold text-slate-400 mb-3">已选择文件</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">B面视频:</span>
                <span className="text-violet-400">{bVideos.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">A面视频:</span>
                <span className="text-violet-400">{aVideos.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">封面图:</span>
                <span className="text-violet-400">{covers.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">背景图:</span>
                <span className="text-violet-400">{bgImage.length}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoMergeExample;
```

## Props 说明

### FileSelector

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | `string` | - | 唯一标识，用于目录缓存和粘贴识别 |
| `name` | `string` | - | 显示名称 |
| `accept` | `'video' \| 'image' \| 'all' \| string[]` | - | 接受的文件类型 |
| `multiple` | `boolean` | `false` | 是否允许多选 |
| `showList` | `boolean` | `true` | 是否显示文件列表 |
| `minHeight` | `number` | `120` | 上传区域最小高度 |
| `maxHeight` | `number` | `280` | 文件列表最大高度 |
| `disabled` | `boolean` | `false` | 是否禁用 |
| `defaultValue` | `string[]` | `[]` | 默认文件路径 |
| `themeColor` | `'cyan' \| 'violet' \| 'rose' \| 'amber' \| 'emerald'` | `'cyan'` | 主题颜色 |
| `directoryCache` | `boolean` | `true` | 是否记住上次目录 |
| `onChange` | `(files: string[]) => void` | - | 值变化回调 |
| `onPreview` | `(file: FileItem) => void` | - | 自定义预览处理 |

### FileSelectorGroup

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `children` | `ReactNode` | - | FileSelector 子组件 |
| `onFilesChange` | `(selectorId: string, files: string[]) => void` | - | 文件变化回调 |

## 功能特性

### 1. 拖放上传
- 支持拖放文件到上传区域
- 拖放时有视觉反馈

### 2. 粘贴文件分配
- 粘贴文件后自动识别兼容的选择器
- 支持拖拽调整文件分配

### 3. 文件预览
- 视频：支持播放控制、音量调节、进度条
- 图片：支持缩放预览
- 其他文件：支持用系统默认打开

### 4. 目录缓存
- 记住上次选择的目录
- 下次打开自动定位到该目录

### 5. 主题颜色
- cyan（青色）- 默认
- violet（紫色）
- rose（玫瑰色）
- amber（琥珀色）
- emerald（翠绿色）

## API 方法

### window.api.getPreviewUrl(path: string)
获取文件预览 URL。

```tsx
const result = await window.api.getPreviewUrl('/path/to/file.mp4');
if (result.success) {
  const previewUrl = result.url;
}
```

### window.api.openInExplorer(path: string)
用系统默认程序打开文件。

### window.api.showItemInFolder(path: string)
在文件管理器中显示文件。
