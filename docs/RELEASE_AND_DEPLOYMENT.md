# 发布与部署说明

桌面客户端和授权服务使用两条独立流水线：授权服务部署到 veFaaS；常规桌面版本只发布到专用 TOS 更新桶。迁移期间仅使用一次 GitHub 桥接 Workflow，让旧客户端安装内置 TOS 更新地址的新版本；桥接版运行时仍然只访问 TOS。私有 GitHub 仓库只保存源码和运行 CI，不作为客户端更新源。授权业务 JSON 与更新安装包必须使用不同的 TOS Bucket 和不同的最小权限凭据。

## 授权服务自动部署

`.github/workflows/deploy-license-server.yml` 在 Pull Request 中执行类型检查、测试、构建与依赖门禁，合并到 `master` 后部署 `videostitcher-license-prod`。在 GitHub Environment `license-production` 中配置：

| 类型 | 名称 | 用途 |
|---|---|---|
| Secret | `VOLC_ACCESS_KEY_ID` | 仅能部署目标函数的火山子账号 AK |
| Secret | `VOLC_SECRET_ACCESS_KEY` | 对应 SK |
| Secret | `VOLC_SESSION_TOKEN` | 使用 STS 时设置，可留空 |
| Variable | `LICENSE_SERVER_HEALTH_URL` | 必填的线上 `/health` HTTPS 地址 |

函数自身的签名私钥、pepper、TOS 业务存储配置和管理员初始化配置留在 veFaaS 加密环境变量中，Workflow 不修改这些秘密。首次创建所有者时临时设置 `LICENSE_ALLOW_ADMIN_BOOTSTRAP=true`；成功后确认独立初始化标记存在，立即改为 `false`。

若启用管理后台“版本管理”，还需在 veFaaS 函数环境变量中配置：

| 类型 | 名称 | 用途 |
|---|---|---|
| Secret | `GITHUB_RELEASE_TOKEN` | Fine-grained Token，仅授予 `luweiCN/VideoStitcher` 的 Metadata 读取、Contents 读取和 Actions 读写 |
| Variable | `VIDEO_STITCHER_UPDATE_BASE_URL` | 与桌面发布 Environment 相同的 TOS `stable` 公网 HTTPS 地址 |
| Variable | `TOS_UPDATE_BUCKET` | 更新安装包专用 Bucket，当前为 `videostitcher-updates-prod` |
| Variable | `TOS_UPDATE_REGION` / `TOS_UPDATE_ENDPOINT` / `TOS_UPDATE_PREFIX` | 默认分别为 `cn-beijing`、`tos-cn-beijing.volces.com`、`stable` |

仓库、分支和发布 Workflow 文件名默认分别为 `luweiCN/VideoStitcher`、`master` 和 `release.yml`，通常不需要额外配置。Token 只由授权函数调用 GitHub API，不能进入浏览器、Electron 或业务 JSON。切换已有版本不调用 GitHub，而是由授权函数使用 IAM 角色临时凭证直接操作 TOS；函数角色需要读取 `stable/releases/index.json` 和历史清单，并允许写入、删除 `stable/releases/switch.lock`，写入 `stable/channel.json`、`stable/latest*.yml` 与 `stable/releases/index.json`。

## 桌面客户端发布

在 GitHub Environment `desktop-release` 中配置：

| 类型 | 名称 | 用途 |
|---|---|---|
| Variable | `VIDEO_STITCHER_LICENSE_API_URL` | 正式授权 API 的 HTTPS 根地址 |
| Secret | `VIDEO_STITCHER_LICENSE_SIGNING_PUBLIC_KEY_BASE64` | Ed25519 PEM 公钥的 Base64 |
| Variable | `VIDEO_STITCHER_UPDATE_BASE_URL` | TOS/CDN 的 `stable` HTTPS 目录 |
| Secret | `TOS_UPDATE_ACCESS_KEY_ID` / `TOS_UPDATE_SECRET_ACCESS_KEY` | 只允许写更新桶指定前缀的凭据 |
| Secret | `TOS_UPDATE_SESSION_TOKEN` | 使用 STS 时设置，可留空 |
| Variable | `TOS_UPDATE_REGION` / `TOS_UPDATE_ENDPOINT` / `TOS_UPDATE_BUCKET` | 更新桶配置 |
| Variable | `TOS_UPDATE_PREFIX` | 默认 `stable`，需与更新 URL 对应 |
| Variable | `RELEASE_NOTES_AI_MODEL` | 可选，GitHub Models 模型；默认 `openai/gpt-4o` |

建议两个 Environment 都启用 Required reviewers。正式发布流程不会改写或推送版本提交：维护人员先提交并评审版本号，再手动输入相同版本触发 Workflow。任何测试、配置或产物检查失败都会阻止 Release。

当前采用零证书费用的过渡发布方式：macOS 使用 ad-hoc 临时签名并保留 hardened runtime，同时固定 `com.videostitcher.app` 指定要求以维持版本间自动更新；Windows 安装包不签名。它与旧版的未签名发布方式兼容，不会使已经安装或下载的旧包失效；但 macOS Gatekeeper 和 Windows SmartScreen 仍可能提示未知开发者/未知发布者，需要用户手动放行。免费签名不能证明发布者身份，更新安全仍依赖 HTTPS、TOS 写权限隔离和清单哈希。开始大规模商业销售前，应再切换为固定的 Developer ID 与 Authenticode 发布者身份。

- Workflow 自动读取上一个私有版本标签到当前提交之间的标题与正文，再由 GitHub Models 整理成面向用户的简体中文更新说明。提交内容只作为不可信数据，不上传源码差异。AI 超时、限流或格式异常时自动退回规则摘要，不会阻断发布；触发页面仍保留可选的人工覆盖字段处理特殊情况。
- 最终同一份说明会写入 `latest.yml`、`latest-mac.yml`，客户端从 TOS 检查更新时直接展示；同时保存为不可变的 `stable/releases/<version>.json` 和 `stable/versions/<version>/latest*.yml`，并更新 `stable/releases/index.json`。每次 TOS 发布成功后创建私有 Git 标签，作为下一版的提交比较基线。
- “发布桌面客户端到 TOS”用于所有常规版本，只发布 TOS。上传后会对安装包和 blockmap 发起 Range 请求，未返回 `206 Partial Content` 时发布失败，避免误以为差分更新已经可用。
- 管理后台“版本管理”读取 master 的 `package.json` 版本号，更新说明留空时继续使用现有 AI/提交摘要逻辑；发布进度和失败详情来自 GitHub Actions。后台不负责修改代码版本号。
- 管理后台“设为当前”由授权服务直接复制已经归档的两个清单并更新 TOS 当前指针，不经过 GitHub Actions，也不重建、不覆盖或删除安装包。降低当前版本时仍会签发限定来源、目标和有效期的 Ed25519 回退指令；切换过程使用 TOS 短期互斥锁，并在公网清单验证成功后记录管理员审计日志。旧客户端不支持自动回退，第一次使用前应先发布并普及包含该能力的新版本。
- 已发布版本永久保留且版本号不可复用。当前阶段不提供删除版本、候选通道、灰度发布和额外审批流。
- “发布一次性 GitHub 桥接版本”仅在迁移时使用一次。它调用同一构建流程，先发布并验证 TOS，再把已经写入更新说明的同一批 Actions Artifacts 发布为 GitHub Release，不会重新构建。
- 桥接 Workflow 需要 `contents: write` 创建 tag 和 Release；常规 Workflow 保持 `contents: read`。

## 自定义域名

授权函数通过 API 网关服务对外提供访问。生产环境建议先给现有网关服务绑定稳定域名，例如 `license.example.com`，配置 HTTPS 证书与 CNAME 后，再把 `VIDEO_STITCHER_LICENSE_API_URL` 和 `LICENSE_SERVER_HEALTH_URL` 改为该域名。后续更换网关时只需调整 DNS，不必为了修改授权 API 地址重新发布客户端。

更新安装包不经过函数或 API 网关。若需要 `download.example.com`，应单独在 TOS/CDN 配置，并把 `VIDEO_STITCHER_UPDATE_BASE_URL` 指向其 `stable` 目录，避免由网关中转大文件产生额外流量和破坏 Range 差分下载。

## 私有仓库切换与存量客户端迁移

1. 先配置更新专用 TOS Bucket；安装包和 blockmap 使用带版本文件名及长缓存，`latest.yml`、`latest-mac.yml` 使用短缓存或不缓存。
2. 在受审查的提交中把版本号提升到严格高于 `v2.8.0`，例如 `v2.9.0`。该桥接版的构建配置和运行时代码都只认识 TOS。
3. 手动触发“发布一次性 GitHub 桥接版本”，填写版本号，通常让更新说明覆盖字段保持为空。Workflow 自动生成说明且只构建一次，先按 pointer-last 顺序发布 TOS，再把完全相同的安装包、blockmap、manifest 和说明发布到 GitHub Release。
4. 已安装的旧版本通过现有 GitHub 更新源发现并安装桥接版；桥接版启动后只从 TOS 检查后续版本，不保留 GitHub 网络故障回退。
5. 通过授权心跳中的客户端版本确认活跃用户已经迁移，再使用“发布桌面客户端到 TOS”发布一个仅存在于 TOS 的更高版本，实测桥接版到新版本的增量更新。
6. 验证成功后把 GitHub 仓库转为私有。遗漏迁移的旧客户端使用 TOS 上保留的桥接安装包手动覆盖安装，不能在客户端嵌入 GitHub Token。
7. GitHub Actions 的临时构建产物只保留三天，不写入客户端，也不是更新回退源。
