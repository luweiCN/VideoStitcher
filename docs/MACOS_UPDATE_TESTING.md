# macOS 自动更新功能测试指南

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 构建项目
```bash
npm run build
```

### 3. 运行开发模式
```bash
npm run dev
```

### 4. 测试更新功能

1. 打开应用后，进入"控制中心"（右上角齿轮图标）
2. 切换到"版本更新"标签
3. 点击"检查更新"按钮

## 测试环境要求

### 真实更新测试
要完整测试更新流程，需要：

1. **创建新的 Release**
   - 在 GitHub 仓库创建一个比当前版本更高的 Release
   - Tag 格式：`v0.5.0`（当前是 `v0.4.6`）

2. **上传 macOS ZIP 包**
   - 文件名必须包含 `mac` 或 `darwin` 关键字
   - 例如：`VideoStitcher-0.5.0-mac.zip`

3. **打包命令**
   ```bash
   npm run dist:mac
   ```
   生成的文件在 `dist/` 目录

### 模拟测试（不需要 Release）

可以测试以下功能：
- ✅ 检查更新 API 调用
- ✅ UI 状态变化
- ✅ 错误处理
- ✅ 进度显示

## 预期行为

### 检查更新
- **有新版本**: 显示版本号、日期、更新说明，按钮变为"下载更新"
- **已是最新**: 显示"已是最新版本"
- **网络错误**: 显示错误信息，保持"检查更新"按钮

### 下载更新
- 显示实时下载进度（0% - 100%）
- 完成后按钮变为"立即重启并安装"

### 安装更新
- 点击后应用自动退出
- 后台脚本执行安装
- 新版本自动启动

## 调试方法

### 查看主进程日志
```bash
# 开发模式会在终端显示日志
npm run dev
```

日志格式：
```
[macOS 更新] 当前版本: 0.4.6
[macOS 更新] 最新版本: 0.5.0
[macOS 更新] 发现新版本: {...}
[macOS 更新] 开始下载到: /tmp/VideoStitcher-Update-0.5.0.zip
[macOS 更新] 下载完成
```

### 查看更新脚本日志
```bash
# 安装完成后查看
cat /tmp/updater.log
```

### 查看更新脚本内容
```bash
# 下载完成后查看
cat /tmp/update-install.sh
```

## 常见问题

### Q: 检查更新失败
**A**: 检查网络连接，或查看是否有 Rate Limit（GitHub API 限制）

### Q: 下载进度卡住
**A**: 检查网络速度，大文件下载可能需要较长时间

### Q: 点击安装后没反应
**A**: 
1. 查看 `/tmp/updater.log`
2. 确保应用有写入 `/Applications` 的权限
3. 确保 ZIP 包结构正确

### Q: 新版本启动失败
**A**: 
- 脚本会自动恢复备份
- 手动恢复：`mv /tmp/VideoStitcher-Backup.app /Applications/`

## 平台兼容性

- ✅ macOS (darwin) - 应用内自动更新
- ✅ Windows - 使用原有的 electron-updater
- ⏳ Linux - 待实现

## 文档链接

- [功能详细说明](./MACOS_AUTO_UPDATE.md)
- [实现总结](./MACOS_UPDATE_SUMMARY.md)

## 需要帮助？

如有问题，请查看：
1. 主进程日志（终端输出）
2. 更新脚本日志 (`/tmp/updater.log`)
3. 渲染进程控制台（DevTools）

---

**提示**: 首次测试建议在虚拟机或测试环境中进行，确保数据安全。
