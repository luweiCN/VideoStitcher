# macOS 应用内自动更新功能说明

## 功能概述

实现了完整的 macOS 应用内自动更新功能，无需苹果开发者账号。用户可以在应用内直接下载和安装更新，无需手动下载 DMG 文件。

## 核心特性

### 1. 自动检查更新
- 从 GitHub Releases API 获取最新版本信息
- 智能版本号比较，准确判断是否有新版本
- 显示版本号、发布日期和更新说明

### 2. 应用内下载
- 支持大文件下载，带实时进度显示
- 自动处理 HTTP 重定向
- 下载失败自动清理临时文件

### 3. 自动安装
- 创建独立的 bash 更新脚本
- 主应用退出后脚本继续运行
- 自动备份旧版本，安装失败可恢复
- 安装完成后自动启动新版本
- 自动清理临时文件

## 技术实现

### 文件结构

```
src/
├── main/
│   ├── updater.ts         # 更新管理器核心逻辑
│   ├── updater.js         # 编译后的文件
│   ├── ipc-handlers.ts    # IPC 通信处理
│   └── ipc-handlers.js    # 编译后的文件
├── main.js                # 主进程入口（集成更新器）
├── preload.ts            # Preload API 定义
└── renderer/
    └── features/
        └── AdminMode.tsx  # 更新 UI 界面
```

### 关键技术点

#### 1. 独立进程技术
```typescript
const child = spawn('/bin/bash', [scriptPath], {
  detached: true,      // 脱离父进程
  stdio: 'ignore',     // 不继承 stdio
  env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin' }
});
child.unref();         // 允许父进程退出
```

#### 2. 更新脚本设计
```bash
#!/bin/bash
# 1. 等待主应用退出（检查 PID）
# 2. 备份旧版本到 /tmp
# 3. 复制新版本到原位置
# 4. 启动新版本
# 5. 清理临时文件和自己
```

#### 3. 版本比较算法
```typescript
// 支持 semver 格式：MAJOR.MINOR.PATCH
// 逐段比较，返回 true 表示有新版本
compareVersions("0.4.6", "0.5.0") // => true
```

## 使用方法

### 用户操作流程

1. 打开应用 → 进入"控制中心" → "版本更新"标签
2. 点击"检查更新"按钮
3. 如果有新版本，显示更新信息，点击"下载更新"
4. 等待下载完成（显示进度条）
5. 点击"立即重启并安装"
6. 应用自动退出，后台安装，完成后自动启动

### 开发者配置

#### 1. GitHub Release 要求

发布新版本时，需要上传 macOS 的 ZIP 包：

```bash
# 文件名必须包含 'mac' 或 'darwin' 关键字
VideoStitcher-0.5.0-mac.zip
VideoStitcher-darwin-x64.zip
```

#### 2. 打包命令

```bash
# 构建 macOS 版本
npm run dist:mac

# 打包后会生成 .zip 文件
# 将此文件上传到 GitHub Release
```

#### 3. Release 格式

- **Tag name**: `v0.5.0` (必须以 v 开头)
- **Release title**: 任意
- **Description**: 更新说明（支持 Markdown）
- **Assets**: 上传 macOS ZIP 包

## 测试步骤

### 1. 本地测试

```bash
# 1. 构建项目
npm run build

# 2. 启动应用
npm run dev

# 3. 进入控制中心 → 版本更新
# 4. 点击"检查更新"
```

### 2. 模拟更新流程

由于需要真实的 GitHub Release，建议：

1. 在测试仓库创建一个新版本（比当前版本高）
2. 上传测试用的 ZIP 包
3. 修改 `src/main/updater.ts` 中的仓库地址为测试仓库
4. 运行应用测试完整流程

### 3. 检查日志

更新脚本会生成日志文件：

```bash
# 查看更新日志
cat /tmp/updater.log
```

日志内容包括：
- 主应用退出状态
- 备份操作结果
- 安装操作结果
- 启动新版本状态
- 清理操作结果

## 错误处理

### 常见问题

#### 1. 下载失败
- **原因**: 网络问题或 GitHub 服务不可用
- **处理**: 自动清理临时文件，显示错误信息
- **解决**: 用户重新点击"下载更新"

#### 2. 解压失败
- **原因**: ZIP 文件损坏或权限不足
- **处理**: 删除临时目录，回滚状态
- **解决**: 重新下载或检查系统权限

#### 3. 安装失败
- **原因**: 权限不足或文件被占用
- **处理**: 脚本自动恢复备份
- **解决**: 确保应用有写入权限，关闭防病毒软件

#### 4. 未找到 .app 文件
- **原因**: ZIP 包结构不正确
- **处理**: 递归查找 .app 文件
- **解决**: 确保 ZIP 包包含完整的 .app 结构

### 调试技巧

#### 1. 查看控制台日志

```javascript
// 渲染进程控制台
console.log('[macOS 更新]', ...);

// 主进程日志
console.log('[macOS 更新] 当前版本:', currentVersion);
```

#### 2. 查看更新脚本

```bash
# 脚本位置
ls -lh /tmp/update-install.sh

# 查看内容
cat /tmp/update-install.sh

# 手动执行（调试用）
bash /tmp/update-install.sh
```

## 安全性考虑

### 1. 签名验证
当前版本未实现签名验证。建议未来版本添加：
- 验证下载文件的 SHA256 哈希
- 验证 GitHub Release 的真实性

### 2. 权限控制
- 只能更新到 `/Applications` 或用户有权限的目录
- 脚本使用最小权限运行
- 备份机制防止数据丢失

### 3. 文件来源
- 只从官方 GitHub Releases 下载
- 使用 HTTPS 确保传输安全
- User-Agent 标识应用身份

## 与 Windows 更新的区别

| 特性 | Windows | macOS |
|------|---------|-------|
| 更新方式 | electron-updater | 自定义实现 |
| 安装包格式 | .exe (Squirrel) | .zip |
| 后台安装 | Squirrel 自动处理 | Bash 脚本 |
| 签名要求 | 需要代码签名 | 无需签名 |
| 开发者账号 | 不需要 | 不需要 |

## 未来改进方向

1. **增量更新**: 只下载变更的文件，减少下载大小
2. **签名验证**: 验证下载文件的完整性和来源
3. **回滚机制**: 如果新版本有问题，支持回滚到旧版本
4. **静默更新**: 在后台自动下载，用户空闲时安装
5. **多语言支持**: 更新说明支持多语言显示

## 许可证

本功能遵循项目的开源许可证。
