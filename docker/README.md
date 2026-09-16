# zsxian22/yapi

`0.1.0` 是本镜像的首个版本（同时提供 `0.1`、`latest`），基于 YApi 社区维护版 1.11.2。Mac、Linux、Windows（Docker Desktop / WSL2）执行 `docker pull` 时会按 CPU 自动选择 `linux/amd64` 或 `linux/arm64`。

默认管理员：`admin@admin.com` / `yapi.pro`（登录后请立刻修改）。

## 这个版本解决了哪些问题

原版 YApi 已停更，调试接口还要装 Chrome 跨域插件，商店下架后几乎不可用。`0.1.0` 用服务端代发请求替代插件，并把能跑的社区维护版打成可直接 pull 的多架构镜像。

1. **调试接口不再依赖 Chrome 跨域插件**  
   原版运行页、测试集合批量运行都依赖 `cross-request` 扩展。Chrome 商店下架后只能本地安装，跨域失败、插件检测弹窗是常态。本版本由 YApi 服务端代发真实请求（`POST /interface/run`），运行页可切换「服务器代理 / 浏览器直发」（选择会记在本地）。集合批量运行默认走服务器代理，不再检查插件是否安装。云元数据地址（如 `169.254.169.254`）始终拦截，防止 SSRF；内网 / 本机是否允许由 `runProxy.allowPrivateIp` 控制。请求超时、响应体大小也可配。

2. **原版停更，新环境装不上**  
   官方镜像和 `yapi-pro-cli` 已不可用，旧 Node / MongoDB / Koa 在新系统上依赖冲突。镜像内为 Node 20，配合 MongoDB 6。

3. **Mac、Linux、Windows 不能共用一份镜像**  
   Apple Silicon 与 x86 服务器架构不同。本版本同时发布 `amd64` 和 `arm64`，pull 时自动选择。

4. **启动前必须手写并挂载 config.json**  
   没有配置文件容器会直接退出。本版本内置默认配置，数据库、邮件、通行密钥、服务端代理等常用项可用环境变量覆盖。

5. **社区版已修的使用问题**（随 1.11.2 带入）  
   Docker 下 `config.json` 路径算错导致读不到配置；Ace Editor worker 在 SPA 路由下加载失败，接口 JSON/JS 校验失效；通行密钥登录时验证码框不出现、首次 406 自动发信。上述问题已修复，并支持 WebAuthn 通行密钥。

## 构建与推送到 Docker Hub

在仓库根目录操作。不要把 Docker Hub 密码、Access Token、数据库口令写进命令、脚本或本文档。

```bash
# 交互登录即可，不要使用 -p 明文密码
docker login
```

账号须对命名空间 `zsxian22` 有写权限。仓库请设为 Public，别人才能直接 `docker pull`。

### 多架构构建并推送（推荐）

一次打出 `linux/amd64` 与 `linux/arm64`，Mac / Linux / Windows 拉取时自动选架构：

```bash
VERSION=0.1.0
IMAGE=zsxian22/yapi

docker buildx use desktop-linux

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --pull=false \
  --provenance=false \
  --sbom=false \
  -t "${IMAGE}:${VERSION}" \
  -t "${IMAGE}:0.1" \
  -t "${IMAGE}:latest" \
  --build-arg YAPI_IMAGE_VERSION="${VERSION}" \
  --push \
  .
```

若 `--push` 因网络中断失败、但本地已有镜像，可补推（仍不要在命令里写密码）：

```bash
docker push "${IMAGE}:${VERSION}"
docker push "${IMAGE}:0.1"
docker push "${IMAGE}:latest"
```

### 仅导出 tar（不推仓库）

给离线机器用时，按目标架构构建后 `docker save`：

```bash
VERSION=0.1.0
IMAGE=zsxian22/yapi

# 常见 Linux 服务器
docker buildx build --platform linux/amd64 -t "${IMAGE}:${VERSION}" --load .
docker save "${IMAGE}:${VERSION}" | gzip > "yapi-${VERSION}-linux-amd64.tar.gz"
```

目标机：

```bash
gunzip -c yapi-0.1.0-linux-amd64.tar.gz | docker load
```

### 验证

```bash
docker buildx imagetools inspect zsxian22/yapi:0.1.0
```

应同时看到 `linux/amd64` 与 `linux/arm64`。Docker Hub 的 Overview 可粘贴本文档，粘贴前确认没有真实口令、Token。

## 快速开始（推荐 Compose）

将下面保存为 `docker-compose.yml` 后执行 `docker compose up -d`，浏览器打开 http://127.0.0.1:3000 。

```yaml
services:
  mongo:
    image: mongo:6
    restart: unless-stopped
    volumes:
      - mongo-data:/data/db
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s

  yapi:
    image: zsxian22/yapi:0.1.0
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      TZ: Asia/Shanghai
      YAPI_DB_SERVERNAME: mongo
      YAPI_DB_PORT: "27017"
      YAPI_DB_DATABASE: yapi
      YAPI_ADMIN_ACCOUNT: admin@admin.com
      YAPI_PASSKEY_RP_ID: localhost
      YAPI_PASSKEY_ORIGIN: http://localhost:3000
    depends_on:
      mongo:
        condition: service_healthy

volumes:
  mongo-data:
```

本仓库也可直接使用：

```bash
docker compose -f docker-compose.hub.yml up -d
```

## docker run

需要先有可访问的 MongoDB（容器名、主机名或连接串）：

```bash
docker run -d --name yapi \
  -p 3000:3000 \
  -e YAPI_DB_SERVERNAME=mongo \
  -e YAPI_DB_PORT=27017 \
  -e YAPI_DB_DATABASE=yapi \
  --link mongo:mongo \
  zsxian22/yapi:0.1.0
```

更推荐用上面的 Compose，避免手动处理网络和依赖顺序。

## 环境变量

未设置的项使用镜像内默认 `config.json`。环境变量会在启动时写入 `/yapi/config.json`。

若把该文件以只读方式挂载（`:ro`），环境变量不会生效，以挂载文件为准。

### 基础

| 变量 | 对应配置 | 默认值 | 说明 |
|---|---|---|---|
| `TZ` | — | `Asia/Shanghai` | 容器时区 |
| `YAPI_PORT` / `PORT` | `port` | `3000` | 服务监听端口（容器内） |
| `YAPI_ADMIN_ACCOUNT` | `adminAccount` | `admin@admin.com` | 首次初始化的管理员邮箱 |
| `YAPI_TIMEOUT` | `timeout` | `120000` | HTTP 超时，单位毫秒 |
| `YAPI_CLOSE_REGISTER` | `closeRegister` | `false` | `true` 时关闭开放注册 |
| `YAPI_VERSION_NOTIFY` | `versionNotify` | `false` | 是否开启版本通知 |
| `YAPI_CONFIG_PATH` | — | `/yapi/config.json` | 配置文件写入路径 |

布尔值可写：`true` / `false` / `1` / `0` / `yes` / `no`。

### 数据库

| 变量 | 对应配置 | 默认值 | 说明 |
|---|---|---|---|
| `YAPI_DB_SERVERNAME` | `db.servername` | `mongo` | MongoDB 主机名 |
| `YAPI_DB_PORT` | `db.port` | `27017` | MongoDB 端口 |
| `YAPI_DB_DATABASE` | `db.DATABASE` | `yapi` | 数据库名 |
| `YAPI_DB_USER` | `db.user` | 空 | 有认证时填写 |
| `YAPI_DB_PASS` | `db.pass` | 空 | 有认证时填写 |
| `YAPI_DB_AUTHSOURCE` | `db.authSource` | 空 | 认证库，如 `admin` |
| `YAPI_DB_CONNECTSTRING` | `db.connectString` | 空 | 完整连接串，设置后优先于上面的主机/端口 |

连接外部 MongoDB 示例：

```yaml
environment:
  YAPI_DB_SERVERNAME: <DB_HOST>
  YAPI_DB_PORT: "27017"
  YAPI_DB_DATABASE: yapi
  YAPI_DB_USER: <DB_USER>
  YAPI_DB_PASS: <DB_PASSWORD>
  YAPI_DB_AUTHSOURCE: admin
```

或：

```yaml
environment:
  YAPI_DB_CONNECTSTRING: mongodb://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:27017/yapi?authSource=admin
```

### 邮件（可选）

启用后可用于找回密码、通行密钥场景下的邮件验证码等。

| 变量 | 对应配置 | 说明 |
|---|---|---|
| `YAPI_MAIL_ENABLE` | `mail.enable` | 是否启用 SMTP，默认 `false` |
| `YAPI_MAIL_HOST` | `mail.host` | SMTP 主机，如 `smtp.163.com` |
| `YAPI_MAIL_PORT` | `mail.port` | SMTP 端口，如 `465` |
| `YAPI_MAIL_FROM` | `mail.from` | 发件人地址 |
| `YAPI_MAIL_USER` | `mail.auth.user` | SMTP 用户名 |
| `YAPI_MAIL_PASS` | `mail.auth.pass` | SMTP 授权码，勿写入仓库 |

### 服务端代发（runProxy）

运行页「服务器代理」与测试集合批量运行走服务端代发时生效。

| 变量 | 对应配置 | 默认值 | 说明 |
|---|---|---|---|
| `YAPI_RUN_PROXY_TIMEOUT` | `runProxy.timeout` | `30000` | 代发超时，单位毫秒 |
| `YAPI_RUN_PROXY_MAX_BODY_SIZE` | `runProxy.maxBodySize` | `2097152` | 响应体大小上限，单位字节（默认 2MB） |
| `YAPI_RUN_PROXY_ALLOW_PRIVATE_IP` | `runProxy.allowPrivateIp` | `true` | 是否允许代发到内网 / 本机；云元数据地址始终拦截 |

生产环境若 YApi 与业务服务不在同一内网，建议设为 `false`，避免容器被用来打内网。

### 通行密钥（可选）

生产环境建议显式配置，且站点走 HTTPS。本地可用 `localhost`。

| 变量 | 对应配置 | 默认值 | 说明 |
|---|---|---|---|
| `YAPI_PASSKEY_RP_NAME` | `passkey.rpName` | `YApi` | 注册时展示名称 |
| `YAPI_PASSKEY_RP_ID` | `passkey.rpID` | `localhost` | 访问域名的主机名，不含端口 |
| `YAPI_PASSKEY_ORIGIN` | `passkey.origin` | `http://localhost:3000` | 浏览器实际访问来源，需含协议 |

生产示例：

```yaml
environment:
  YAPI_PASSKEY_RP_NAME: YApi
  YAPI_PASSKEY_RP_ID: yapi.example.com
  YAPI_PASSKEY_ORIGIN: https://yapi.example.com
```

## 用 config.json 代替环境变量

高级项（LDAP、插件等）仍可通过挂载完整配置：

```yaml
services:
  yapi:
    image: zsxian22/yapi:0.1.0
    volumes:
      - ./config.json:/yapi/config.json:ro
```

只读挂载时环境变量不会覆盖文件内容。

## 默认账号

首次启动会初始化管理员：

- 邮箱：`admin@admin.com`（可用 `YAPI_ADMIN_ACCOUNT` 修改）
- 密码：`yapi.pro`（登录后请立刻修改）

已有数据库时不会重复创建管理员。
