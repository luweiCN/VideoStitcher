# VideoStitcher 授权服务

该目录包含可部署到火山引擎 veFaaS 的授权 API 和运营控制台。

## 已实现能力

- 客户端首次连接时自动建立授权设备档案，后台不按设备 ID 预先建档；服务端只保存带 pepper 的设备指纹哈希；
- 授权主体是当前设备，不建立客户端用户账号；管理员可执行设备更换，新设备连接后自动继承套餐队列；
- 同一机器自动领取一次 7 天免费试用，重装不会重置截止日；
- 后台动态创建套餐，默认预置月度、季度和年度套餐；
- 套餐支持按天、按月或长期有效，并可配置客户端展示、购买地址和外部 SKU；
- 新老设备可共享一条全局权益，后续可统一设置截止时间或停用；
- 新设备首次接入可自动获得一份默认套餐包，无需手动领取且不会给老设备补发；
- 管理员可为单台设备编辑运营备注和标签、发放套餐包，并把月度、季度、年度或赠送套餐按顺序排队；
- 后台支持按标签、权益、套餐、在线/前台状态、系统平台、客户端版本和今日使用量等维度筛选；
- 支持按勾选或当前筛选结果批量发放，执行前预览命中数、跳过重复套餐，并可整批撤回未结束套餐；
- 批量发放使用幂等操作编号，网络重试不会重复发包，同一编号也不能复用到其他发放请求；
- 当前套餐到期后自动启用下一个套餐；发错的待生效或生效中套餐可以撤回并保留审计记录；
- 套餐包区分运营赠送、确认购买和历史迁移来源；
- 管理员可按套餐生成最多 500 个一批的一次性套餐兑换码，暂停或恢复整批，并查看剩余和已兑换数量；
- 套餐兑换码明文只在生成成功时返回一次，服务端 JSON 只保存带 pepper 的不可逆摘要；
- 客户端“软件授权”页可查看当前权益和套餐队列，过期试用设备也能进入并自助兑换；
- 历史永久授权和自定义期限数据继续兼容，但不再出现在新建销售授权入口；
- 设备首次连接、会话验证、停用和一对一绑定；
- 5 分钟心跳，15 分钟内视为在线；
- 心跳写入独立的 `activity/<deviceId>.json`，按天累计前台时长和打开次数，不反复改写主业务 `state.json`；
- 后台汇总全部、有效、试用、默认权益、设备套餐、在线状态和今日前台使用时长；
- 独立“使用分析”页按设备展示今日时长、启动次数、近 7 天趋势和客户端版本；
- 管理端可暂停、撤销、恢复授权设备，修改备注，并执行设备更换；
- Ed25519 签名的 30 分钟短期设备会话；
- 管理员高风险操作原因和审计日志；
- 管理员账号、所有者/运营管理员两级角色、停用、密码重置与自助改密；
- 管理员密码使用 scrypt 独立加盐哈希，8 小时后台会话使用 Ed25519 签名；
- React + Mantine 管理后台，使用内容哈希资源并与 API 同源部署；
- 本地文件和 TOS 私有 JSON 存储适配，主状态与高频活动数据分开保存；
- 主状态在每次写入前校验唯一约束和关联完整性，达到 5 MiB 时输出迁移数据库预警；
- 请求体限制、接口限频和统一错误响应。

## 本地验证

本地配置仍然必须使用随机测试密钥，不要复制生产密钥。

```bash
cd services/license-server
npm install --ignore-scripts

# 生成首次所有者密码的摘要
printf '%s' '替换为至少 10 位随机密码' | shasum -a 256

# 生成 Ed25519 私钥
openssl genpkey -algorithm Ed25519
```

复制 `.env.example` 中的变量到当前终端或本地密钥管理工具，然后执行：

```bash
npm test
npm run build
npm run dev
```

`npm run dev` 会同时监听服务端 TypeScript、管理后台 React 和编译后的 Node 入口：服务端修改后自动重编译并重启，后台修改后自动生成新的哈希资源。`npm start` 只用于运行已经构建好的版本，不提供热更新。

控制台地址为 `http://127.0.0.1:8787`。首次使用时以 `owner`（可通过 `LICENSE_BOOTSTRAP_ADMIN_USERNAME` 修改）和上一步密码登录，服务会创建所有者账号并把密码转换为独立加盐的 scrypt 哈希。之后在“管理员账号”页为团队成员创建独立账号；每位管理员可从右上角账号菜单验证当前密码并自行修改，成功后该账号的全部旧会话立即失效。原摘要不再作为通用管理口令。签名后的登录会话只保存在标签页 `sessionStorage`，关闭标签页即清除。

TOS 生产环境默认关闭所有者初始化。首次部署时临时设置 `LICENSE_ALLOW_ADMIN_BOOTSTRAP=true`，创建所有者并确认 `admin-bootstrap-complete` 标记已经写入后，立即改为 `false` 并重新部署。该独立标记不会随主状态 JSON 一起丢失；如果主状态被误删，服务会拒绝再次使用初始化口令创建所有者。

## 免费试用与 QQ 群配置

服务端通过 `LICENSE_TRIAL_DAYS` 控制试用天数，默认是 7。试用记录绑定哈希后的机器指纹：只删除客户端会话或重装应用不会重新计算 7 天，但重装操作系统可能改变机器 ID。客户端还会生成一对由系统安全存储加密保存的 Ed25519 设备密钥；服务端会同时校验机器指纹和设备签名。只复制会话令牌到另一台电脑不能直接使用，设备密钥丢失或系统重装后需要管理员执行可审计的“更换授权设备”。机器 ID 只能作为关联和风控信号，不能证明同一个真人或永久不变的物理设备；控制本机管理员权限的攻击者仍可能提取或绕过客户端凭据。

桌面端的 QQ 群入口配置在 `src/shared/config/license-runtime.json`：

| 字段 | 说明 |
|------|------|
| `community.qqGroupNumber` | 到期页展示并允许复制的 QQ 群号 |
| `community.qqGroupUrl` | QQ 群官方 HTTPS 加群链接 |
| `trialDays` | 客户端提示文案，应与服务端 `LICENSE_TRIAL_DAYS` 保持一致 |

群号或链接暂未确定时可保持空字符串，试用到期页会改为提示用户联系软件提供方。

## 数码荔枝等渠道的套餐码交付

月度、季度和年度套餐继续由后台动态维护。开始收费后，在“套餐兑换码”页选择套餐、数量和销售渠道生成一批码，立即导出 CSV；若销售渠道支持卡密库存，可把这批码导入对应商品，购买者收到码后在桌面端“软件授权”页自行兑换。渠道只负责收款和交付码，授权服务器负责一次性核销和套餐队列，因此新增套餐不需要修改客户端代码。

当前边界如下：

- 一个套餐码只成功兑换一次，并绑定兑换时的当前设备；同一设备因网络重试重复提交时不会重复发包；
- 套餐规则在生成批次时固化，之后归档或修改套餐模板不会改变已经售出的码；
- 全局权益仍在生效时，购买兑换的套餐会进入等待队列，全局权益结束后自动接续；
- 暂停批次只阻止尚未使用的码，已经兑换形成的套餐包不受影响；发错或退款仍通过“撤回套餐包”处理并保留审计记录；
- 明文套餐码无法从后台再次查看。生成后必须立即保存 CSV，丢失时只能暂停旧批次并重新生成。

`purchaseUrl` 和 `externalSku` 继续作为客户端商品链接与渠道备注保留，但当前套餐码核销不依赖渠道回调或 SKU。以后若渠道提供可靠的订单 API，可增加“订单成功后自动取码/发码”的连接器，不需要改变套餐队列和兑换接口。

## 心跳与使用时长

桌面端每 5 分钟上报一次心跳，并根据主窗口是否可见、未最小化且获得焦点上报前台状态。主业务数据保存在 `license-platform/state.json`；每台设备的活动聚合保存在 `license-platform/activity/<deviceId>.json`，因此高频心跳不会抢占授权设备、套餐和审计日志的主对象写入。

活动文件保存最近 120 天的按日聚合，包括前台秒数和打开次数。单次心跳最多累计两个心跳周期，避免断网或休眠被误算成长时间使用。当前统计用于小团队运营观察，不应当作计费凭证；并发和分析需求明显增长后再迁移数据库。

用户、套餐、发放批次和审计记录仍保持在一个主 JSON 中，避免小团队阶段过早分片带来跨对象一致性问题。每次写入都会先做完整性校验；主状态达到 5 MiB 会在函数日志中告警，此时应评估迁移数据库，而不是继续拆分更多业务 JSON。

## 火山引擎部署

### GitHub Actions 自动部署

仓库中的 `.github/workflows/deploy-license-server.yml` 是默认部署入口：

- Pull Request 修改授权服务时，只运行类型检查、测试、构建和后台脚本检查；
- 合并到 `master` 后，只要 `services/license-server/` 有变化就自动部署生产函数；
- 需要重跑或指定 Git ref 时，可在 GitHub Actions 页面手动触发“部署授权服务”；
- `license-server-production` concurrency group 保证同一时间只有一次生产部署，避免并发覆盖。

首次使用时，在 GitHub 仓库 `Settings → Environments` 创建 `license-production`，并配置：

| 类型 | 名称 | 说明 |
|------|------|------|
| Secret | `VOLC_ACCESS_KEY_ID` | 仅允许部署目标函数的火山引擎子账号 AK |
| Secret | `VOLC_SECRET_ACCESS_KEY` | 对应 SK |
| Secret（可选） | `VOLC_SESSION_TOKEN` | 使用 STS 临时凭据时设置 |
| Variable | `LICENSE_SERVER_HEALTH_URL` | 完整健康检查地址，例如 `https://license.example.com/health`；缺失时禁止部署 |

建议为 `license-production` 设置 Required reviewers。部署账号必须使用独立 IAM 子账号并遵循最小权限，禁止使用主账号 AK/SK。GitHub workflow 只负责上传代码，不管理函数业务密钥；`LICENSE_SIGNING_PRIVATE_KEY`、`LICENSE_KEY_PEPPER` 和首次所有者密码摘要 `LICENSE_ADMIN_TOKEN_HASH` 继续保存在 veFaaS 函数环境变量中。

veFaaS CLI 支持直接读取 `VOLC_ACCESS_KEY_ID` 和 `VOLC_SECRET_ACCESS_KEY`。Workflow 会先用非持久化的 `login --check` 验证凭据，再执行部署，因此不需要浏览器 SSO，也不会把凭据写入仓库配置文件。命令和环境变量以[火山引擎 veFaaS CLI 官方说明](https://www.volcengine.com/docs/6662/2206937)及 CLI 自带帮助为准。

### 本地应急部署

火山引擎官方 `vefaas-cli` 支持登录、关联函数、上传代码、发布、环境变量和日志。首次只需登录和关联一次：

```bash
cd services/license-server
npm run deploy:login
npm run deploy:link
```

需要在 GitHub Actions 不可用时应急部署，可执行：

```bash
npm run deploy
```

部署命令会先生成只包含编译产物和生产依赖的 `.deploy` 目录，再发布 `videostitcher-license-prod`，同时保持预留实例为 0、最大实例为 2。部署目录在根部提供兼容 `index.handler` 的入口，因此不需要 Workflow 修改函数 Handler。生产密钥不放在 npm script 中，环境变量首次通过控制台或 `vefaas function env import --file <本机私密文件>` 配置。

管理界面与 API 使用同一部署包和同一个 HTTPS 域名：`GET /admin` 由函数返回 React 构建后的静态 HTML/CSS/JS，页面再请求同源 `/v1/admin/*`。当前规模不需要另买静态网站托管或 CDN。

1. 创建 TOS 私有桶，授权函数账号仅能读写 `license-platform/state.json`、`license-platform/admin-bootstrap-complete` 和 `license-platform/activity/*` 对象。
2. 创建 veFaaS Node.js 20+ 函数，入口保持为 `index.handler`。
3. 函数环境变量中设置：
   - `LICENSE_STORAGE_DRIVER=tos`
   - `LICENSE_BOOTSTRAP_ADMIN_USERNAME=owner`（可选）
   - `LICENSE_ALLOW_ADMIN_BOOTSTRAP=true`（仅首次创建所有者时临时启用，完成后必须改为 `false`）
   - `LICENSE_ADMIN_TOKEN_HASH`
   - `LICENSE_KEY_PEPPER`
   - `LICENSE_SIGNING_PRIVATE_KEY`
   - `LICENSE_TRIAL_DAYS=7`
   - `TOS_REGION`、`TOS_ENDPOINT`、`TOS_BUCKET`、`TOS_OBJECT_KEY`
4. 为事件函数绑定只允许访问上述两个对象范围的 IAM 服务角色。代码会从 veFaaS Context 读取并轮换 STS 临时凭据；生产环境不需要设置 `TOS_ACCESS_KEY`、`TOS_SECRET_KEY` 和 `TOS_STS_TOKEN`。
5. 通过弹性 API 网关暴露 HTTPS，配置：
   - `/v1/devices/connect`：单 IP 10 次/10 分钟；
   - `/v1/plans`：客户端公开读取套餐；
   - `/v1/packages/center`：持设备会话读取当前权益和套餐队列；
   - `/v1/packages/redeem`：持设备会话兑换套餐码，额外限制为单 IP 20 次/10 分钟；
   - `/v1/licenses/heartbeat`、`/validate`：单 IP 120 次/分钟；
   - `/v1/admin/auth/login`：单 IP 10 次/15 分钟；
   - `/v1/admin/*`：仅允许管理网络或额外接入大厂身份认证/WAF；
   - 最大请求体 64 KiB；
   - 每日预算告警和异常调用告警。
6. 在 `desktop-release` GitHub Environment 中配置正式授权地址和 Ed25519 公钥；正式地址通过构建期常量写入 Bridge 安装包，不允许打包后的环境变量改写。

### TOS 一致性验收

当前实现使用对象 ETag + `If-Match` 条件写入；首次创建使用禁止覆盖，409/412 会进入有限重试。正式上线前必须用实际桶完成以下并发测试：

1. 同时发送两个创建/状态修改请求，两个变更都应保留，不能静默覆盖；
2. 故意使用旧 ETag 写入，TOS 必须返回 409/412；
3. 连续制造 5 次以上冲突时，API 应失败并告警，不能无限重试；
4. 开启对象版本控制或定时备份，验证能从上一版本恢复。

如果实际 TOS 地域或 SDK 对条件写入的行为不符合以上预期，不得以私有 JSON 正式收款；应改用带事务或条件更新能力的数据库。

## 安全边界

- `LICENSE_SIGNING_PRIVATE_KEY`、`LICENSE_KEY_PEPPER` 和管理员密码绝不能进入 Electron。
- TOS 当前适合极低并发。正式销售前应在控制台验证条件写入能力，尤其要验证同一码并发兑换只能成功一次；出现明显并发兑换或管理操作后迁移到支持事务/条件写入的数据库。
- 套餐码生成响应中的明文只交给管理员导出；日志、审计事件和 `state.json` 都不能记录明文套餐码。
- 当前已使用独立管理员账号、角色权限、密码哈希、登录锁定和可撤销会话。对外生产运营前仍建议在 API 网关前增加 MFA、VPN/IP 白名单或企业身份认证。
- Electron 可以被逆向，客户端校验不是最终信任根。授权状态、设备绑定、撤销和新会话签发都以服务端为准。
- 在线是“最后一次心跳在 15 分钟内”的推断；不能据此断言用户正坐在电脑前。
