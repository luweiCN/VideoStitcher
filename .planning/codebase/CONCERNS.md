# 代码库关注项

**分析日期:** 2026-03-24

## 技术债务

### 未实现功能占位符

**封面压缩任务（cover_compress）:**
- 位置: `src/main/services/TaskQueueManager.ts:507`
- 问题: 任务类型已定义但实现为空，仅输出日志即标记完成
- 影响: 用户选择封面压缩任务时无实际效果
- 修复建议: 实现基于 Sharp 的图片压缩逻辑

**知识库删除功能:**
- 位置: `src/main/services/KnowledgeBase.ts:158`
- 问题: `deleteMaterial` 方法仅记录警告，未实现实际删除逻辑
- 影响: 无法清理知识库中的无用素材，导致存储膨胀
- 修复建议: 在 vectorStore 中实现 `deleteByMaterialId` 方法

**知识库统计功能:**
- 位置: `src/main/services/KnowledgeBase.ts:178`
- 问题: `totalMaterials` 直接返回文档数，未统计唯一素材
- 影响: 统计信息不准确
- 修复建议: 按 materialId 去重统计

**火山引擎语音合成:**
- 位置: `src/main/ai/providers/volcengine/index.ts:238`
- 问题: `synthesizeSpeech` 方法抛出未实现错误
- 影响: 依赖此功能的流程会中断
- 修复建议: 接入火山引擎 TTS API

**OpenAI 适配器注册:**
- 位置: `src/main/ai/registry/AdapterRegistry.ts:158`
- 问题: OpenAI 供应商配置存在但未实现注册逻辑
- 影响: 无法使用 OpenAI 模型
- 修复建议: 实现 OpenAIAdapter 和注册逻辑

**OpenAI 配置迁移:**
- 位置: `src/main/ai/config/migration.ts:152`
- 问题: OpenAI 配置迁移逻辑为空
- 影响: 使用旧版 OpenAI 配置的用户可能遇到兼容问题
- 修复建议: 实现 OpenAI 配置的迁移逻辑

**剧本解析逻辑:**
- 位置: `src/main/ai/examples/usage-examples.ts:231`
- 问题: `parseScreenplays` 函数为简化示例，无实际解析能力
- 影响: 示例代码无法用于生产环境
- 修复建议: 实现基于正则或 AST 的剧本解析器

**风格模板加载:**
- 位置: `src/main/ipc/aside-handlers.ts:122`
- 问题: 使用硬编码模拟数据，未从配置文件或数据库加载
- 影响: 用户无法自定义风格模板
- 修复建议: 实现配置化或数据库化的风格模板管理

**角色编辑功能:**
- 位置: `src/main/ipc/director-mode-handlers.ts:295`
- 问题: `aside:edit-character` handler 仅返回成功，未更新数据库或工作流状态
- 影响: 用户编辑角色后更改不会持久化
- 修复建议: 实现完整的数据库更新逻辑

**上传参考图功能:**
- 位置: `src/renderer/pages/ASide/components/DirectorMode/ChatPanel.tsx:409`
- 问题: 文件上传回调仅记录文件名，未实现实际上传逻辑
- 影响: 选角导演无法使用参考图
- 修复建议: 实现文件上传和图像处理流程

**快速合成功能:**
- 位置: `src/renderer/pages/ASide/components/ScreenplayGenerator/index.tsx:208`
- 问题: TODO 注释表明数据传递逻辑未实现
- 影响: 快速合成页面无法获取选中的剧本
- 修复建议: 实现剧本数据传递或状态管理

### 临时方案

**工作流状态缓存:**
- 位置: `src/main/ipc/director-mode-handlers.ts:18`
- 问题: 使用内存 Map 缓存工作流状态，应用重启后丢失
- 影响: 用户中途退出应用后需重新开始导演模式流程
- 修复建议: 将工作流状态持久化到数据库

## 已知问题和限制

### 进程管理

**孤儿进程处理:**
- 位置: `src/main/services/TaskQueueManager.ts:101-126`
- 问题: 应用启动时通过 `process.kill(pid, 0)` 检查进程存在性，但在某些系统上可能不准确
- 影响: 可能误判进程状态，导致任务状态不一致
- 缓解措施: 同时检查输出文件存在性作为辅助判断

**进程终止兼容性:**
- 位置: `src/main/services/TaskQueueManager.ts:1019-1034`
- 问题: 使用 `pkill -P` 和 `taskkill /T` 终止进程树，在不同系统上行为可能不一致
- 影响: 某些情况下可能无法完全终止子进程
- 缓解措施: 使用 `processMonitor` 辅助跟踪进程树

### 系统信息获取

**打包后权限问题:**
- 位置: `src/main/services/TaskQueueManager.ts:1137-1145`
- 问题: `systeminformation` 库在打包后的 Electron 应用中可能因权限问题失败
- 影响: 系统状态监控可能无法正常工作
- 缓解措施: 已添加 try-catch 降级处理，使用默认值继续执行

### AI 工作流

**角色 ID 一致性:**
- 位置: `src/main/ipc/director-mode-handlers.ts:48-76`
- 问题: 历史问题记录显示曾出现角色 ID 不一致问题，虽已修复但需持续关注
- 影响: 可能导致角色图片与角色信息不匹配
- 缓解措施: 优先使用 LangGraph 返回的 profile.id

**图像生成尺寸限制:**
- 位置: `src/main/ipc/director-mode-handlers.ts:636-640`
- 问题: 强制使用 2K 尺寸以满足火山引擎要求，但可能不适合所有场景
- 影响: 生成时间增加，成本上升
- 缓解建议: 根据角色数量动态选择合适尺寸

## 性能瓶颈

### 数据库查询

**任务列表查询:**
- 位置: `src/main/services/TaskQueueManager.ts:1189-1224`
- 问题: 每次状态广播时查询运行中任务 + 最多20条待执行任务，涉及多次数据库查询
- 影响: 每秒执行一次，在高并发时可能成为瓶颈
- 优化建议: 使用缓存或批量查询优化

**知识库检索:**
- 位置: `src/main/services/KnowledgeBase.ts:112-147`
- 问题: 每次检索需进行向量相似度计算，无缓存机制
- 影响: 频繁检索时响应时间增加
- 优化建议: 对热点查询结果添加缓存层

### 图像处理

**角色形象生成:**
- 位置: `src/main/ipc/director-mode-handlers.ts:573-678`
- 问题: 所有角色共用一张大图，单点失败影响全部
- 影响: 任一角色生成失败需全部重新生成
- 优化建议: 支持单角色独立生成和缓存

**分镜图生成:**
- 位置: `src/main/ai/workflows/nodes/storyboard-artist.ts`
- 问题: 5x5 分镜图一次性生成，尺寸大、耗时长
- 影响: 用户等待时间长，超时风险
- 优化建议: 支持分批次生成或流式返回

### 内存使用

**工作流状态缓存:**
- 位置: `src/main/ipc/director-mode-handlers.ts:18`
- 问题: 所有工作流状态保存在内存 Map 中，无淘汰机制
- 影响: 长时间运行后内存占用持续增长
- 优化建议: 添加 LRU 淘汰或持久化到磁盘

**控制台日志:**
- 位置: 全项目共 923 处 `console.log`
- 问题: 生产环境保留大量调试日志
- 影响: 性能开销，日志文件膨胀
- 优化建议: 使用 logger 分级，生产环境关闭 debug 日志

## 安全考虑

### 输入验证

**IPC 处理器参数验证:**
- 位置: 多个 IPC handler 文件
- 问题: 部分 handler 仅做基础非空检查，缺乏深度验证
- 风险: 恶意输入可能导致应用崩溃或数据损坏
- 建议: 对所有用户输入进行严格的类型和范围验证

**文件路径处理:**
- 位置: `src/main/services/TaskQueueManager.ts:1039-1046`
- 问题: `fileExists` 方法直接检查路径，未验证路径合法性
- 风险: 路径遍历攻击
- 建议: 验证路径是否在允许的目录范围内

### 敏感信息

**AI 配置存储:**
- 位置: `config/ai-config.current.json`
- 问题: API 密钥以明文形式存储在 JSON 文件中
- 风险: 密钥泄露
- 建议: 使用系统密钥链或加密存储

**日志中的敏感信息:**
- 位置: 多个日志输出点
- 问题: 部分日志可能输出包含敏感信息的提示词
- 风险: 隐私泄露
- 建议: 审查日志内容，过滤敏感字段

## 维护挑战

### 代码复杂度

**ChatPanel 组件:**
- 位置: `src/renderer/pages/ASide/components/DirectorMode/ChatPanel.tsx`
- 问题: 821 行代码，包含复杂的状态机逻辑（stepRef）
- 影响: 难以测试和维护，容易引入 bug
- 建议: 将工作流逻辑抽取到自定义 hook 或状态机库

**TaskQueueManager:**
- 位置: `src/main/services/TaskQueueManager.ts`
- 问题: 1337 行代码，职责过多（调度、执行、监控、IPC）
- 影响: 违反单一职责原则，测试困难
- 建议: 拆分为 TaskScheduler、TaskExecutor、ProcessMonitor 等模块

### 类型安全

**any 类型使用:**
- 位置: 多处使用 `any` 类型（如 `src/main/ipc/director-mode-handlers.ts:23`）
- 问题: 类型检查失效，运行时错误风险
- 建议: 逐步替换为具体类型或 unknown + 类型守卫

**类型定义分散:**
- 问题: 类型定义散落在多个文件中，缺乏统一管理
- 影响: 类型重复定义、不一致
- 建议: 建立统一的类型定义中心

### 测试覆盖

**IPC 处理器:**
- 问题: 大部分 IPC handler 缺乏单元测试
- 影响: 重构风险高，回归 bug 难以发现
- 建议: 为关键 handler 添加测试

**AI 工作流节点:**
- 问题: AI 节点逻辑复杂但测试覆盖不足
- 影响: 提示词调整后行为难以预测
- 建议: 添加集成测试，验证节点输出格式

## 依赖风险

### 原生依赖

**better-sqlite3:**
- 问题: 需要编译原生模块，postinstall 脚本执行 electron-rebuild
- 风险: 在某些环境（如 CI）下编译失败
- 缓解: 已配置 electron-rebuild，但需确保 Python/VS Build Tools 可用

**sharp:**
- 问题: 图像处理库，需要编译原生模块
- 风险: 版本升级可能导致兼容性问题
- 建议: 锁定版本，升级前充分测试

**sqlite-vec:**
- 问题: SQLite 向量扩展，相对较新（0.1.7-alpha.2）
- 风险: API 可能不稳定，存在未发现的 bug
- 建议: 关注更新，考虑备选方案

### 版本风险

**Electron 30:**
- 问题: 使用 Electron 30，版本较新
- 风险: 可能存在未发现的稳定性问题
- 建议: 关注 Electron 更新，及时应用安全补丁

**React 19:**
- 问题: 使用 React 19（RC 或正式版）
- 风险: 部分第三方库可能尚未完全兼容
- 建议: 测试所有关键依赖的兼容性

## 架构问题

### 状态管理

**工作流状态分散:**
- 问题: 工作流状态存在于内存缓存、数据库、前端状态多个地方
- 影响: 状态同步复杂，容易出现不一致
- 建议: 建立单一数据源，其他层只读或同步更新

**IPC 通信频繁:**
- 位置: `src/main/services/TaskQueueManager.ts:1264`
- 问题: 每秒广播完整状态，包含任务列表
- 影响: 主进程和渲染进程间通信开销
- 建议: 增量更新，只发送变化的数据

### 错误处理

**静默失败:**
- 位置: 多处错误处理仅记录日志
- 问题: 用户可能 unaware 某些操作失败
- 建议: 建立统一的错误通知机制

**错误边界缺失:**
- 问题: React 组件缺乏错误边界保护
- 影响: 单个组件错误可能导致整个应用崩溃
- 建议: 在关键页面添加 Error Boundary

## 改进建议

### 高优先级

1. **实现工作流状态持久化**: 将导演模式工作流状态保存到数据库，支持断点续作
2. **完成封面压缩任务**: 实现实际的图片压缩逻辑
3. **加密存储 API 密钥**: 使用系统密钥链或加密存储保护敏感配置
4. **添加错误边界**: 为关键页面添加 React Error Boundary

### 中优先级

1. **重构 ChatPanel**: 将工作流逻辑抽取到独立模块
2. **拆分 TaskQueueManager**: 按职责拆分为多个小模块
3. **优化数据库查询**: 为频繁查询添加缓存或批量查询
4. **完善类型定义**: 逐步替换 any 类型

### 低优先级

1. **清理调试日志**: 生产环境禁用 debug 日志
2. **完善单元测试**: 为 IPC handler 和 AI 节点添加测试
3. **优化图像生成**: 支持分批次生成和缓存
4. **文档完善**: 补充 API 文档和开发指南

---

*关注项审计: 2026-03-24*
