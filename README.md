# 歌词搜索插件

当歌曲没有歌词时，自动从 [lrclib.net](https://lrclib.net) 或自定义兼容 API 搜索歌词。插件通过服务端歌词提供者回调机制注册，由主程序在需要时自动调用。

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
| GET | `/lyric-search?title=...&artist=...&album=...&duration=...&fingerprint=...&isrc=...` | 歌词搜索（由主程序 InvokeHTTP 调用，fingerprint 和 isrc 为可选参数） |
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
