# VideoStitcher

<div align="center">

**全能视频批处理工具箱**

基于 Electron + FFmpeg 的桌面应用，支持视频拼接、缩放、图片处理等功能

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-30.0.0-blue)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19.2.4-cyan)](https://react.dev/)

</div>

---

## 功能特性

### 🎬 视频处理

| 功能 | 说明 |
|------|------|
| **水平拼接** | 将多个视频左右并排拼接 |
| **垂直拼接** | 将多个视频上下堆叠拼接 |
| **A+B 前后拼接** | 将 A 视频（前）和 B 视频（后）拼接成完整视频 |
| **视频缩放** | 批量调整视频分辨率 |
| **多格式支持** | MP4, MOV, AVI, MKV 等 |

#### A+B 前后拼接 - 智能任务生成算法

当选择多个 A 视频和 B 视频时，系统使用**贪心算法**生成均匀分布的任务组合：

- **均匀分配**：优先选择使用次数最少的素材，确保每个素材被均匀使用
- **无重复组合**：自动避免生成重复的 A+B 组合
- **智能排序**：生成的任务按 A 索引优先排序，便于追踪
- **最大组合数**：最多可生成 A数量 × B数量 个不重复的任务

**算法实现**：`src/renderer/utils/balancedCombinations.ts`

### 🖼️ 图片处理

| 功能 | 说明 |
|------|------|
| **图片压缩** | 批量压缩图片大小 |
| **格式转换** | JPG, PNG, WebP 互转 |
| **网格拼接** | 多图拼接成网格布局 |
| **素材生成** | 生成带比例框的素材图 |

### ⚙️ 其他特性

- **并发处理** - 自动利用 CPU 多核性能
- **进度显示** - 实时显示处理进度和日志
- **拖拽操作** - 支持文件拖拽导入
- **暗色主题** - 护眼的深色界面
- **安全自动更新** - Windows 与 macOS 使用签名安装包，并且只从火山 TOS 更新

---

## 截图

> 截图待补充

---

## 下载安装

### 方式一：下载预编译版本

从官方 QQ 群或产品下载页获取由 TOS 提供的签名安装包：

| 平台 | 推荐下载 |
|------|---------|
| **Windows** | `VideoStitcher-*.exe`（支持自动更新） |
| **macOS** | `VideoStitcher-*.dmg` |
| **Linux** | `videostitcher_*.deb` 或 `.rpm` |

### 方式二：团队成员从私有仓库运行

```bash
# 克隆项目
git clone https://github.com/luweiCN/VideoStitcher.git
cd VideoStitcher

# 安装依赖
npm install

# 开发模式运行
npm run dev
```

---

## 开发指南

### 环境要求

- **Node.js** >= 22.x
- **npm** >= 10.x

### 项目结构

```
VideoStitcher/
├── src/
│   ├── main.js           # Electron 主进程
│   ├── preload.js        # 预加载脚本
│   └── renderer/         # React 前端
│       ├── features/     # 功能模块
│       ├── components/   # 公共组件
│       └── utils/        # 工具函数
├── .github/workflows/    # CI/CD
├── forge.config.js       # Electron Forge 配置
└── package.json
```

### 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发模式 |
| `npm run build:renderer` | 构建前端 |
| `npm run build:preload` | 构建预加载脚本 |
| `npm run make` | 打包应用 |

### 代码规范

请遵守项目 [CLAUDE.md](./CLAUDE.md) 中定义的规范：

- **代码注释** - 使用中文
- **日志输出** - 使用中文
- **提交信息** - 使用中文

---

## 构建发布

### 手动打包

```bash
# Windows
npm run dist:win

# macOS
npm run dist:mac

# Linux
npm run dist:linux
```

输出目录：`dist/`。正式安装包必须提供授权 API、公钥、更新源和平台代码签名配置；缺失时构建会主动失败。

### 自动发布

通过 GitHub Actions 自动构建并发布：

1. 先在代码中更新 `package.json` 与锁文件版本并完成评审；
2. 在 Actions 页面手动触发“发布桌面客户端”；
3. 输入与 `package.json` 完全一致的版本号；
4. Workflow 通过测试、签名和公证后，按 pointer-last 顺序发布到火山 TOS；GitHub 私有仓库不作为更新源。

从公开 GitHub Release 迁移到 TOS 时，单独触发一次“发布一次性 GitHub 桥接版本”。该 Workflow 先发布 TOS，再把同一批产物发布到 GitHub；桥接版安装后只访问 TOS，不包含 GitHub 运行时回退。

授权服务合并到 `master` 后由“部署授权服务”独立发布到 veFaaS。完整的 Environment 变量、密钥和迁移步骤见 [发布与部署说明](docs/RELEASE_AND_DEPLOYMENT.md)。

---

## 常见问题

### Q: Windows 提示"无法安装"

A: 右键安装包，选择"属性"，勾选"解除锁定"后再安装。

### Q: macOS 无法验证或打开应用

A: 正式版本应带 Developer ID 签名和公证票据。不要通过清除隔离属性绕过 Gatekeeper；请保留提示截图、应用版本和下载来源并联系维护人员。

### Q: 处理速度慢怎么办？

A: 在设置中调整"推荐并发数"，一般设为 CPU 核心数 - 1。

### Q: 支持哪些视频格式？

A: 依赖 FFmpeg，支持大部分常见格式：MP4, MOV, AVI, MKV, FLV, WMV 等。

---

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| [Electron](https://www.electronjs.org/) | 30.0.0 | 桌面应用框架 |
| [React](https://react.dev/) | 19.2.4 | UI 框架 |
| [Vite](https://vitejs.dev/) | 6.4.1 | 前端构建工具 |
| [Tailwind CSS](https://tailwindcss.com/) | 4.1.18 | 样式框架 |
| [FFmpeg](https://ffmpeg.org/) | - | 视频/图片处理 |
| [electron-updater](https://www.electron.build/auto-update) | 6.7.3 | 自动更新 |

---

## 路线图

- [ ] 视频裁剪功能
- [ ] 添加水印/字幕
- [ ] 视频转 GIF
- [ ] 批量重命名
- [ ] 更多滤镜效果

---

## 许可证

[MIT License](LICENSE)

---

## 贡献

欢迎提交 Issue 和 Pull Request！

在贡献代码前，请阅读 [CLAUDE.md](./CLAUDE.md) 了解项目规范。

---

<div align="center">

**如果觉得有用，请给个 ⭐ Star**

</div>
