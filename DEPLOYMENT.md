# Nishiki AI Proxy 云服务器部署指南

本指南将帮助你在云服务器（如腾讯云、阿里云、DigitalOcean 等）上部署 Nishiki 前端所需支持的后端服务。服务使用 **Docker Compose** 容器化部署，包含 Node.js 后端与 PostgreSQL 数据库，并使用 **Nginx** 作为反向代理并处理 HTTPS 和 WebSocket 请求。

## 环境要求

- 一台云服务器（建议系统：`Ubuntu 22.04 LTS` 或类似 Linux 发行版）
- 拥有公网 IP，并在安全组/防火墙开放 `80` (HTTP) 和 `443` (HTTPS) 端口
- 已经有一个**域名**解析到服务器公网 IP 流（例如：`blogapi.nishiki.icu`）
- 拥有该服务器的 `root` 权限或具备 `sudo` 权限的用户

## 1. 基础环境搭建

进入你的云服务器终端（使用 SSH 登录）。

**更新系统软件包：**
```bash
sudo apt update && sudo apt upgrade -y
```

**安装 Docker 和 Docker Compose：**
```bash
# 官方一键安装脚本
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 将当前用户加入 docker 组以免总是需要加 sudo (可选)
sudo usermod -aG docker $USER
```

**安装 Nginx 和 Certbot（用来申请免费 HTTPS 证书）：**
```bash
sudo apt install nginx python3-certbot-nginx -y
```

---

## 2. 上传服务器代码

你可以使用 `git clone` 将代码拉取到服务器上，或者使用 `scp` 等工具从本地上传。

假设将代码库克隆在 `/opt/nishikis_app/ai_proxy` 目录下：

```bash
mkdir -p ~/projects
cd ~/projects
# 这里替换为你存放代码的方式，例如 git clone
# git clone <你的仓库地址> nishikis_app
# cd nishikis_app/ai_proxy
```

如果是在本地通过命令上传（假设远程 IP 为 `123.456.78.9`）：
```bash
# 在你电脑本机执行
scp -r ./ai_proxy root@123.456.78.9:/root/projects/
```

进入服务器的 `ai_proxy` 目录：
```bash
cd ~/projects/ai_proxy
```

---

## 3. 配置 .env 环境变量

部署之前，**必须**准备配置信息。

复制示例配置文件（如果你还没创建）：
```bash
cp .env.example .env
nano .env  # 使用 nano 编辑器打开
```

重点配置你的 `.env`，**请仔细确认以下项**：

- `APP_BASE_URL`：改为你的域名（如 `https://blogapi.nishiki.icu`）
- `DATABASE_URL`：不需要改（Docker 里的配置自动用这行通信）
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`：**必须改成你自己的乱码串**（可以用 `openssl rand -hex 32` 随机生成两个）
- `SMTP_*` 相关配置：填写真实的邮箱主账号密码（参考上个话题的授权码方案），否则注册/登录收不到验证码
- `GEMINI_API_KEY` 或 `OPENAI_API_KEY`：填入你的 AI 模型 API Key 用于总结内容。

配置完成之后，使用 `Ctrl + O`, `Enter`, `Ctrl + X` 保存并退出。

---

## 4. 启动 Docker Compose

在包含 `docker-compose.yml` 的目录下执行：

```bash
docker compose up -d --build
```

- `--build` 参数会让 Docker 读取你的 `Dockerfile` 并构建最新的后端镜像。
- `-d` 参数会让容器在后台运行。

这会启动两个容器：
1. `nishiki-postgres`：自动运行在端口 5432（不对外暴露，在网络内部通讯）
2. `nishiki-ai-proxy`：后端主程序，被映射到本机的 `127.0.0.1:8787`

**检查是否运行成功：**
```bash
docker ps
docker compose logs -f ai-proxy
```
如果看到 `Server listening on 0.0.0.0:8787` 字样，说明启动成功（Ctrl+C退出日志查看模式）。

---

## 5. 配置 Nginx 反向代理

项目中已经准备了一个配置文件 `nginx.ai-proxy.conf`。你需要将它适配到你的服务器系统并修改为你自己的域名。

1. **修改配置文件中的域名**
   使用编辑器打开 `nginx.ai-proxy.conf`：
   ```bash
   nano nginx.ai-proxy.conf
   ```
   **将 `server_name API域名;` 改为你的真实域名：**
   ```nginx
   server_name blogapi.yourdomain.com;
   ```

2. **复制并启用配置文件**
   ```bash
   sudo cp nginx.ai-proxy.conf /etc/nginx/sites-available/nishiki_api.conf
   sudo ln -s /etc/nginx/sites-available/nishiki_api.conf /etc/nginx/sites-enabled/
   ```

3. **测试 Nginx 配置并重载**
   ```bash
   sudo nginx -t  # 测试配置文件有没有语法错误
   sudo systemctl reload nginx
   ```

---

## 6. 申请 SSL/HTTPS 证书

Nginx 配置好且域名解析生效后，运行 Certbot 申请并配置免费 HTTPS 证书：

```bash
sudo certbot --nginx -d blogapi.yourdomain.com
```

- 根据提示输入你的邮箱。
- 询问是否同意条款，选 `Y`。
- 申请成功后，Certbot 会自动修改 /etc/nginx 下的配置文件加上 HTTPS（443 端口）设置，你什么都不用管。

最后再次重载 Nginx 以策万全：
```bash
sudo systemctl reload nginx
```

---

## 7. 部署与测试验收

在完成上述全部操作后，请在你的浏览器或终端进行健康检查：

```bash
# 测试 HTTPS 后端是否正常返回（通过你的域名访问）
curl -v https://blogapi.yourdomain.com/api/health
```
如果返回 `{"status":"ok", "db":"connected"}` 等类似字样，这代表配置宣告大功告成。

**App 端需要做的事：**
在 App 的 `.env`（或管理后端 URL 域名的地方），将服务器的域名（`https://blogapi.yourdomain.com`）填入客户端的环境变量或是替换相应常量，客户端就可以直接使用了！

你可以发版、并使用你编写的 App 来注册首个账户，开始体会多端同步和实时 Websocket 推送的爽快感了！
