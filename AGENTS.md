# VideoStitcher

全能视频批处理工具箱 - Electron + React + Vite + Tailwind CSS + FFmpeg

## 快速参考

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式 |
| `npm run build` | 生产构建 |
| `npm run dist:mac` | 打包 macOS 安装包 |
| `npm run dist:win` | 打包 Windows 安装包 |

## 语言规范 ⚠️ 重要

**所有代码相关内容必须使用中文：**
- 代码注释 → 中文
- 日志输出 → 中文
- Git 提交信息 → 中文
- 变量/函数命名 → 英文（编程惯例）

## Git 提交规则 ⚠️ 重要

- **不要自动提交** - 等待用户明确指令
- **不要自动推送** - 提交后等待确认
- **修改完成后提示用户** - 告知修改内容，等待下一步

## 开发服务器规则 ⚠️ 重要

- **不要杀掉开发服务器进程** - 用户会在单独的终端窗口运行 `npm run dev`
- **不要启动开发服务器** - 代码修改后会自动热更新，无需重启

## 详细指南

- [代码风格](.claude/code-style.md) - 注释、日志规范、路径别名
- [Git 工作流](.claude/git-workflow.md) - 提交格式、发布流程
- [架构设计](.claude/architecture.md) - 项目结构、开发注意事项
- [UI 样式](.claude/ui-style.md) - 配色标准、组件示例
