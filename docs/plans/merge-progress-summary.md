# 合并横竖屏极速合成功能 - 实施进度

## 已完成工作

### Phase 1: 数据结构和类型定义 ✅
- [x] 更新 `src/renderer/types.ts` 添加新类型
  - `LayerId` 类型：`'aVideo' | 'bVideo' | 'bgImage' | 'coverImage'`
  - `MaterialPositions` 接口：统一管理所有素材位置
  - `LayerConfig` 接口：图层配置
  - `CanvasOrientation` 和 `CanvasConfig` 类型

- [x] 创建 `src/renderer/utils/positionCalculator.ts`
  - `getCanvasConfig()` - 根据画布方向获取配置
  - `getInitialPositions()` - 计算素材默认位置
  - `getDefaultLayerConfigs()` - 获取默认图层配置

- [x] 更新 `src/preload.ts` 添加新的 API 类型
  - 添加 `bgPosition` 和 `coverPosition` 参数到横屏和竖屏合成 API

### Phase 2: VideoEditor 组件重构 ✅
- [x] 修改 `src/renderer/components/VideoEditor.tsx`
  - 更新 Props 接口支持多素材
  - 支持图层选择和可见性控制
  - 支持图层锁定功能
  - 更新拖拽和缩放逻辑

- [x] 创建 `src/renderer/components/LayerSidebar.tsx`
  - 显示所有素材图层列表
  - 点击选中图层
  - 切换图层可见性
  - 锁定/解锁图层

- [x] 更新 `src/renderer/components/VideoBox.tsx`
  - 支持 `LayerId` 类型
  - 添加 `visible` 和 `locked` 属性
  - 添加 `thumbnail` 属性用于缩略图预览

### Phase 3: FFmpeg 后端更新 ✅
- [x] 修改 `src/ffmpeg/horizontalMerge.js`
  - 添加 `bgPosition` 和 `coverPosition` 参数
  - 支持背景图和封面图独立位置

- [x] 修改 `src/ffmpeg/verticalMerge.js`
  - 添加 `bgPosition` 和 `coverPosition` 参数
  - 支持背景图和封面图独立位置

- [x] 更新 `src/ipcHandlers/video.js`
  - `handleHorizontalMerge` 传递新的位置参数
  - `handleVerticalMerge` 传递新的位置参数

### Phase 5: 创建统一的视频合成组件 ✅
- [x] 创建 `src/renderer/features/VideoMergeMode.tsx`
  - 统一的横竖屏合成组件
  - 画布方向切换器（横屏/竖屏）
  - 集成图层侧边栏
  - 支持所有素材的独立位置调整

## 架构变化

### 数据流
```
用户操作 → VideoMergeMode → MaterialPositions → VideoEditor → VideoBox
                ↓
          LayerSidebar → LayerConfig → 可见性/锁定控制
                ↓
          FFmpeg (horizontalMerge/verticalMerge) → 输出视频
```

### 组件层次
```
VideoMergeMode (统一入口)
├── LayerSidebar (图层管理)
├── VideoEditor (画布编辑器)
│   └── VideoBox (素材框)
└── 素材选择侧边栏
```

## 向后兼容性

- 现有的 `HorizontalMode.tsx` 和 `VerticalMode.tsx` 保持不变
- 它们仍然使用旧的 VideoEditor 接口
- 新的 `VideoMergeMode.tsx` 使用新的统一接口
- 用户可以选择使用哪种模式

## 后续优化

### 2026-02-11: 图片素材处理限制优化 ✅
- [x] **强制 JPG 格式输出**：无论是 800x800 单图还是九宫格切片，统一导出为 JPG 格式。
- [x] **严格文件大小控制**：
    - 九宫格切片：每张图严格限制在 400KB 以内。
    - 800 尺寸单图：严格限制在 400KB 以内。
- [x] **智能压缩算法**：引入了迭代式质量调整算法，在保证文件大小达标的同时尽可能保留图片质量。
- [x] **Logo 质量保证**：先在 2400x2400 高清母图上合成 Logo，再进行切割和压缩，确保 Logo 的清晰度。

## 待完成工作

### Phase 4: 预览弹窗（待实现）
- [ ] 创建 `PreviewModal.tsx` 组件
- [ ] 添加快速预览功能
- [ ] 添加素材切换功能

### Phase 6: FFmpeg 后端合并优化（可选）
- [ ] 考虑合并 `horizontalMerge.js` 和 `verticalMerge.js` 为统一的 `videoMerge.js`
- [ ] 或保留分离但统一参数接口

### Phase 7: UI 优化（可选）
- [ ] 调整布局，确保编辑器和图层侧边栏协调
- [ ] 添加过渡动画
- [ ] 优化触摸/交互体验

## 集成到主应用

要启用新的统一组件，需要在 `App.tsx` 中：

1. 导入 `VideoMergeMode`
2. 添加新的路由和入口按钮
3. 或者替换现有的横竖屏入口

示例：
```tsx
import VideoMergeMode from './features/VideoMergeMode';

// 在路由中
if (currentView === 'videoMerge') {
  return <VideoMergeMode onBack={() => setCurrentView('home')} />;
}

// 在首页添加入口按钮
<button onClick={() => setCurrentView('videoMerge')}>
  统一极速合成 (新版)
</button>
```

## 验证测试清单

- [ ] **控件功能测试**
  - [ ] 每个素材都可以独立拖拽移动
  - [ ] 每个素材都可以独立调整大小
  - [ ] 吸附功能正常工作
  - [ ] 图层侧边栏可以正确选中素材
  - [ ] 图层可见性切换正常
  - [ ] 图层锁定功能正常

- [ ] **画布方向切换测试**
  - [ ] 横屏/竖屏切换正常
  - [ ] 切换后位置重新计算正确
  - [ ] 画布尺寸显示正确

- [ ] **合成输出测试**
  - [ ] 横屏模式输出视频位置与控件设置一致
  - [ ] 竖屏模式输出视频位置与控件设置一致
  - [ ] 背景图位置正确
  - [ ] 封面图位置正确

## 技术亮点

1. **统一的类型系统**：所有素材使用相同的 `Position` 和 `LayerConfig` 接口
2. **灵活的配置系统**：`CanvasConfig` 根据方向动态计算
3. **智能位置计算**：根据视频元数据和画布尺寸自动调整素材位置
4. **图层管理**：类似专业设计软件的图层侧边栏
5. **向后兼容**：现有功能保持不变，新功能独立实现
