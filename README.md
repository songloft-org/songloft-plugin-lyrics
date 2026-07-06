# 歌词搜索插件

当歌曲没有歌词时，自动从 [lrclib.net](https://lrclib.net) 或自定义兼容 API 搜索歌词。插件通过服务端歌词提供者回调机制注册，由主程序在需要时自动调用。

---

## 本次 PR 新增：在线元数据插件（online-metadata）

在原有 LRClib 歌词搜索基础上，新增了一个聚合多平台的在线元数据获取插件，支持自动获取歌词和封面。

### 新增功能

- **六大平台聚合搜索**：网易云音乐、酷狗音乐、QQ音乐、酷我音乐、咪咕音乐、LRClib
- **自动获取**：播放歌曲时自动从多平台搜索歌词和封面
- **智能匹配**：基于歌名、歌手、专辑、时长多维匹配，避免匹配到无关内容
- **元数据利用**：优先使用歌曲内嵌元数据（album、duration）提高匹配精度
- **配置界面**：Web UI 支持拖拽排序平台优先级、开关控制、在线测试搜索
- **繁简体兼容**：自动处理搜索结果中的繁简体差异
- **封面获取**：支持封面自动写入歌曲

### 平台支持状态

| 平台 | 搜索 | 歌词 | 封面 |
|------|------|------|------|
| 网易云音乐 | 公开API | LRC+翻译+罗马音 | 支持 |
| 酷狗音乐 | 可用 | KRC/LRC | 支持 |
| QQ音乐 | 移动端API | 旧版+新版API | 支持 |
| 酷我音乐 | Web版API | JSON格式LRC | 支持 |
| 咪咕音乐 | 签名API | 明文LRC | 支持 |
| LRClib | 稳定 | 纯文本/LRC | 不支持 |

### QuickJS 兼容性处理

- 替换 AbortController（QuickJS 不支持）
- 自定义 Base64/UTF-8 编解码
- 自定义 zlib 解压（通过 Go 桥接）
- 处理酷我单引号 JSON 返回格式
- 处理咪咕三维数组搜索结果结构

---

## 安装

1. 下载 [lyrics.jsplugin.zip](../../releases/latest)
2. 放入 Songloft 的 `data/jsplugins/` 目录
3. 重启 Songloft

## 功能

- **自动搜索**：注册为服务端歌词提供者，歌曲无歌词时主程序自动调用搜索
- **精确 + 模糊两级匹配**：先按标题/艺术家/专辑/时长精确匹配，失败后降级到模糊搜索
- **同步歌词优先**：搜索结果中有同步歌词（LRC 格式）时优先选取
- **自定义 API**：支持切换到自部署的 lrclib 兼容 API
- **配置页面**：提供 Web UI 管理开关和提供商设置，支持在线测试搜索

## 使用

### 启用插件

安装后默认**未启用**。打开插件配置页面，勾选「启用歌词搜索」并保存。启用后插件会向主程序注册歌词提供者，禁用时自动取消注册。

### 提供商选择

- **lrclib.net**（默认）：免费开放的歌词数据库，无需注册
- **自定义 API**：填入兼容 lrclib API 格式的自定义地址（需提供 `/api/get` 精确查询和 `/api/search` 模糊搜索端点）

### 测试搜索

配置页面底部提供测试搜索功能，可输入歌曲名和艺术家验证连通性和匹配效果。

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/lyric-search?title=...&artist=...&album=...&duration=...` | 歌词搜索（由主程序 InvokeHTTP 调用） |
| GET | `/config` | 获取当前配置 |
| PUT | `/config` | 更新配置 |
| GET | `/test-search?title=...&artist=...` | 测试搜索 |
| GET | `/` | 重定向到配置页面 |

## 开发与构建

基于 `@songloft/plugin-sdk` 和 TypeScript 构建，运行在 QuickJS 沙盒中。

```bash
npm install
npm run dev       # watch + auto-upload to local Songloft
npm run build     # produce dist/lyrics.jsplugin.zip
```

## 环境要求

- Songloft v2.6.0+

## 许可

Apache-2.0
