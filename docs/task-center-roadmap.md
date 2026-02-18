# 任务中心实施路线图

## 文档索引

| 文档 | 内容 | 状态 |
|------|------|------|
| [task-center-design.md](./task-center-design.md) | 整体设计方案、架构 | ✅ 已更新 |
| [task-center-database.md](./task-center-database.md) | 数据库方案、迁移、备份修复 | ✅ 已更新 |
| [task-center-api.md](./task-center-api.md) | IPC 接口、React Hook | ✅ 已完成 |
| [task-center-ui.md](./task-center-ui.md) | UI 组件、指示器、设置页面 | ✅ 已更新 |

---

## 需求变更记录

### v2 更新（基于用户反馈）

1. **数据库管理**
   - 数据库文件命名改为 `VideoStitcher.db`
   - 添加版本迁移机制，支持跨版本升级
   - 添加数据库完整性检查和修复功能
   - 添加备份/恢复/导出/导入功能
   - 设置页面添加「数据库」标签页

2. **执行时间统计**
   - 任务添加 `executionTime` 字段
   - 任务中心显示总运行时间

3. **UI 架构调整**
   - 任务中心浮窗：只显示运行中的任务，实时同步
   - 任务列表页面：独立页面，完整任务管理
   - 任务详情页面：独立页面
   - 首页右上角：详细任务指示器
   - 功能页面 PageHeader：简洁任务指示器

4. **功能模块改造**
   - **移除**「开始处理」按钮和直接处理功能
   - **移除** 功能模块中的任务状态相关代码
   - **改为**「添加到任务中心」按钮
   - 添加成功后弹窗询问是否清空编辑区域

---

## 实施阶段概览

```
阶段一: 基础设施 ─────────────────────────────────► 4-5 天
         │
         ├── 安装 better-sqlite3
         ├── 数据库初始化（含迁移机制）
         ├── Repository 层实现
         ├── 备份/恢复/修复功能
         ├── IPC 处理器
         └── TaskContext 状态管理

阶段二: 任务中心 UI ─────────────────────────────► 4-5 天
         │
         ├── 首页任务指示器
         ├── 功能页面 HeaderTaskIndicator
         ├── 任务中心浮窗（运行中任务）
         ├── 任务列表页面
         ├── 任务详情页面
         └── 数据库设置标签页

阶段三: 功能模块改造 ────────────────────────────► 5-6 天
         │
         ├── 移除直接处理逻辑
         ├── 添加「添加到任务中心」按钮
         ├── 实现任务配置转换
         ├── 添加成功弹窗
         └── 清空编辑区域逻辑
         
         改造模块:
         ├── VideoMergeMode
         ├── ResizeMode
         ├── VideoStitcherMode
         ├── ImageMaterialMode
         ├── CoverFormatMode
         ├── CoverCompressMode
         └── LosslessGridMode

阶段四: 任务执行引擎 ────────────────────────────► 3-4 天
         │
         ├── TaskQueueManager 重构
         ├── 任务暂停/恢复
         ├── 执行时间统计
         ├── 并发控制
         └── 错误处理和重试

阶段五: 完善和优化 ──────────────────────────────► 2-3 天
         │
         ├── 性能优化
         ├── 用户体验改进
         ├── 测试用例
         └── 文档完善

总计: 约 18-23 个工作日
```

---

## 阶段一：基础设施（预计 4-5 天）

### 1.1 任务清单

- [ ] 安装和配置 better-sqlite3
  - [ ] `npm install better-sqlite3`
  - [ ] `npm install @types/better-sqlite3 -D`
  - [ ] 配置 electron-builder 的 asarUnpack
  
- [ ] 创建数据库模块
  - [ ] `src/main/database/index.ts` - 数据库初始化
  - [ ] `src/main/database/schema.sql` - 表结构定义
  - [ ] `src/main/database/migrations/index.ts` - 迁移机制
  - [ ] `src/main/database/backup.ts` - 备份恢复
  - [ ] `src/main/database/repair.ts` - 检查修复
  
- [ ] 创建 Repository 层
  - [ ] `src/main/database/repositories/task.repository.ts`
  - [ ] `src/main/database/repositories/task-log.repository.ts`
  - [ ] `src/main/database/repositories/config.repository.ts`
  
- [ ] 创建类型定义
  - [ ] `src/shared/types/task.ts` - 共享类型
  
- [ ] 创建 IPC 处理器
  - [ ] `src/main/ipc/task.ts` - 任务相关 IPC
  - [ ] `src/main/ipc/database.ts` - 数据库管理 IPC
  
- [ ] 更新 Preload 脚本
  - [ ] `src/preload/index.ts` - 暴露任务和数据库 API
  
- [ ] 创建 TaskContext
  - [ ] `src/renderer/contexts/TaskContext.tsx`
  - [ ] `src/renderer/hooks/useTaskCenter.ts`

### 1.2 交付物

- 可运行的数据库模块
- 迁移机制正常工作
- 备份恢复功能可用
- 基础的 CRUD 操作
- IPC 通信正常工作

---

## 阶段二：任务中心 UI（预计 4-5 天）

### 2.1 任务清单

- [ ] 创建任务指示器组件
  - [ ] `src/renderer/components/TaskIndicator/HomeTaskIndicator.tsx` - 首页详细版
  - [ ] `src/renderer/components/TaskIndicator/HeaderTaskIndicator.tsx` - 功能页简洁版
  - [ ] `src/renderer/components/TaskIndicator/TaskCenterWidget.tsx` - 全局浮窗
  
- [ ] 创建任务列表页面
  - [ ] `src/renderer/features/TaskList/index.tsx` - 主页面
  - [ ] `src/renderer/features/TaskList/components/TaskStats.tsx` - 统计卡片
  - [ ] `src/renderer/features/TaskList/components/TaskFilters.tsx` - 筛选栏
  - [ ] `src/renderer/features/TaskList/components/TaskCard.tsx` - 任务卡片
  
- [ ] 创建任务详情页面
  - [ ] `src/renderer/features/TaskDetail/index.tsx` - 主页面
  - [ ] `src/renderer/features/TaskDetail/components/TaskInfo.tsx` - 任务信息
  - [ ] `src/renderer/features/TaskDetail/components/TaskFilesList.tsx` - 素材列表
  - [ ] `src/renderer/features/TaskDetail/components/TaskOutputsList.tsx` - 输出文件
  - [ ] `src/renderer/features/TaskDetail/components/TaskLogsPanel.tsx` - 日志面板
  
- [ ] 创建数据库设置页面
  - [ ] `src/renderer/features/AdminMode/tabs/DatabaseTab.tsx`
  - [ ] 数据库信息展示
  - [ ] 清理功能
  - [ ] 备份管理
  - [ ] 修复功能
  
- [ ] 更新 App.tsx
  - [ ] 添加任务列表和详情路由
  - [ ] 添加首页入口卡片
  - [ ] 添加全局任务浮窗

### 2.2 交付物

- 首页右上角任务指示器
- 功能页面 PageHeader 指示器
- 全局任务浮窗
- 完整的任务列表页面
- 完整的任务详情页面
- 数据库管理设置页面

---

## 阶段三：功能模块改造（预计 5-6 天）

### 3.1 改造策略（重要变更）

**核心变更**：移除直接处理功能，统一使用任务中心

#### 移除的内容

1. **状态**
   - `isProcessing` 状态
   - `tasks` 状态（预览用的临时任务列表）
   - 处理进度相关状态

2. **函数**
   - `startProcessing()` 函数
   - 任务状态更新函数

3. **Hooks**
   - `useVideoProcessingEvents` hook
   - `useImageProcessingEvents` hook

4. **组件**
   - `OperationLogPanel` 组件（日志在任务详情中查看）
   - 任务列表中的状态相关 UI

5. **IPC 调用**
   - `window.api.videoMerge()`
   - `window.api.videoStitch()`
   - 等直接处理调用

#### 新增的内容

1. **状态**
   - 无新增（使用全局 TaskContext）

2. **函数**
   - `handleAddToTaskCenter()` - 添加任务到中心
   - `clearEditor()` - 清空编辑区域

3. **组件**
   - `AddSuccessModal` - 添加成功弹窗

4. **IPC 调用**
   - `window.api.createTask()` - 创建任务

### 3.2 改造流程（每个模块）

```typescript
// 改造前
const startProcessing = async () => {
  setIsProcessing(true);
  await window.api.videoMerge(tasks);
};

// 改造后
const handleAddToTaskCenter = async () => {
  const result = await window.api.createTask({
    type: 'video_merge',
    name: generateTaskName(),
    outputDir,
    params: buildTaskParams(),
    files: collectFiles(),
  });
  
  if (result.success) {
    setShowSuccessModal(true);
    setCreatedTaskId(result.task!.id);
  }
};

const clearEditor = () => {
  // 清空素材
  setBVideos([]);
  setAVideos([]);
  setCovers([]);
  setBgImages([]);
  
  // 重置参数
  setOrientation('horizontal');
  setMaterialPositions(getInitialPositions());
  setTaskCount(1);
  setTasks([]);
};
```

### 3.3 任务清单

- [ ] VideoMergeMode 改造
  - [ ] 移除 isProcessing 状态
  - [ ] 移除 startProcessing 函数
  - [ ] 移除 useVideoProcessingEvents
  - [ ] 移除 OperationLogPanel
  - [ ] 添加 handleAddToTaskCenter
  - [ ] 添加 AddSuccessModal
  - [ ] 实现 clearEditor
  
- [ ] ResizeMode 改造
  - [ ] 同上
  
- [ ] VideoStitcherMode 改造
  - [ ] 同上
  
- [ ] ImageMaterialMode 改造
  - [ ] 同上（使用 Sharp 处理）
  
- [ ] CoverFormatMode 改造
  - [ ] 同上
  
- [ ] CoverCompressMode 改造
  - [ ] 同上
  
- [ ] LosslessGridMode 改造
  - [ ] 同上

### 3.4 交付物

- 所有功能模块使用任务中心
- 移除所有直接处理代码
- 添加任务成功后弹窗
- 清空编辑区域功能正常

---

## 阶段四：任务执行引擎（预计 3-4 天）

### 4.1 任务清单

- [ ] 创建 TaskQueueManager
  - [ ] `src/main/services/TaskQueueManager.ts`
  - [ ] 并发控制逻辑
  - [ ] 任务调度逻辑
  - [ ] 执行时间统计
  
- [ ] 创建 TaskExecutor
  - [ ] `src/main/services/TaskExecutor.ts`
  - [ ] FFmpeg 执行封装
  - [ ] Sharp 执行封装
  - [ ] 进度回调
  
- [ ] 实现任务控制
  - [ ] 暂停/恢复机制
  - [ ] 取消机制
  - [ ] 重试机制
  
- [ ] 更新 IPC 处理器
  - [ ] 连接 TaskQueueManager
  - [ ] 发送进度/日志事件

### 4.2 交付物

- 稳定的任务执行引擎
- 任务可正常执行完成
- 支持暂停/恢复/取消
- 执行时间统计准确

---

## 阶段五：完善和优化（预计 2-3 天）

### 5.1 任务清单

- [ ] 性能优化
  - [ ] 虚拟列表（大量任务）
  - [ ] 数据库查询优化
  - [ ] 内存使用优化
  
- [ ] 用户体验
  - [ ] 任务完成通知
  - [ ] 快捷键支持
  - [ ] 批量操作
  
- [ ] 测试
  - [ ] 数据库迁移测试
  - [ ] 备份恢复测试
  - [ ] 任务生命周期测试
  
- [ ] 文档
  - [ ] 用户指南
  - [ ] 更新日志

### 5.2 交付物

- 性能测试报告
- 完整的测试覆盖
- 用户文档

---

## 风险和依赖

### 技术风险

| 风险 | 级别 | 应对措施 |
|------|------|----------|
| better-sqlite3 编译失败 | 高 | 提供 sql.js 作为 fallback |
| 数据库升级失败 | 高 | 迁移在事务中执行，失败自动回滚 |
| 数据库损坏 | 中 | 自动备份 + 修复功能 |
| 任务执行中断 | 中 | 定期保存进度到数据库 |
| 内存泄漏 | 中 | 定期监控和测试 |

### 依赖关系

```
阶段一 (基础设施)
    │
    ├──► 阶段二 (UI) - 需要 TaskContext 和 IPC
    │
    └──► 阶段四 (执行引擎) - 需要 Repository
    
阶段三 (模块改造) - 需要阶段一、二的 API
    │
    └──► 阶段五 (优化) - 需要完整功能
```

---

## 验收标准

### 功能验收

- [ ] 可在任意功能模块添加任务
- [ ] 添加任务后界面立即响应（不阻塞）
- [ ] 首页右上角显示任务状态指示器
- [ ] 功能页面显示简洁任务指示器
- [ ] 全局浮窗显示运行中的任务
- [ ] 任务列表页面可管理所有任务
- [ ] 任务详情页面可查看完整信息
- [ ] 可暂停/恢复/取消任务
- [ ] 可修改未开始任务的输出目录
- [ ] 关闭软件后重新打开任务仍在
- [ ] 可设置并发数和线程数
- [ ] 任务日志实时显示
- [ ] 任务完成后可预览输出文件
- [ ] 数据库可备份/恢复
- [ ] 数据库可检查和修复
- [ ] 执行时间统计准确

### 性能验收

- [ ] 支持 1000+ 任务不卡顿
- [ ] 任务列表滚动流畅（60fps）
- [ ] 数据库操作响应 < 100ms

### 稳定性验收

- [ ] 连续运行 24 小时无崩溃
- [ ] 异常断电后数据完整
- [ ] 数据库迁移不会丢失数据
- [ ] 内存使用稳定

---

## 开发环境准备

```bash
# 1. 安装依赖
npm install better-sqlite3
npm install @types/better-sqlite3 -D

# 2. 如果 better-sqlite3 安装失败，可能需要
npm install --save-dev electron-rebuild
npx electron-rebuild

# 3. 启动开发服务器
npm run dev
```

---

## 下一步

请审阅以上设计文档，确认后我将开始**阶段一：基础设施**的实施。

如有任何问题或需要调整的地方，请随时告知。
