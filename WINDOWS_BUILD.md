# Windows 打包指南

## 前置要求

- Windows 10 或更高版本
- Node.js 18+ 和 npm
- Git

## 打包步骤

### 1. 克隆项目

```bash
git clone <你的仓库地址>
cd VideoStitcher
```

### 2. 安装依赖

```bash
npm install
```

> 这会自动下载 Windows 版本的 Electron 和 FFmpeg

### 3. 打包应用

```bash
npm run make
```

### 4. 查看输出

打包完成后，在以下位置找到文件：
```
out\make\zip\win32\x64\
```

找到 `video-stitcher-win32-x64-0.1.0.zip`，解压后直接运行 `video-stitcher.exe` 即可

## 常见问题

### Q: npm install 报错？
A: 确保使用 PowerShell 或 CMD 以管理员身份运行

### Q: 打包后应用无法启动？
A: 检查 Windows Defender 是否拦截了应用，添加信任即可

### Q: 运行时提示"找不到 ffmpeg.dll"？
A: 这是 ffmpeg 未正确打包导致，检查以下内容：

1. 确认 `app.asar.unpacked\node_modules\ffmpeg-static\` 目录中是否有 `ffmpeg.exe`
2. 查看应用日志中的 `[DEBUG] ffmpeg path:` 行，确认路径是否正确
3. 如果没有该目录，重新打包：
   ```bash
   rmdir /s /q out
   npm run make
   ```

### Q: FFmpeg 不工作？
A: 重新安装 ffmpeg-static：
```bash
npm uninstall ffmpeg-static
npm install ffmpeg-static
```

## 开发模式

在 Windows 上开发调试：

```bash
npm run dev
```

## 仅打包不生成安装包

如果只需要打包后的应用（不需要安装包）：

```bash
npm run package
```

输出位于：`out\video-stitcher-win32-x64\`
