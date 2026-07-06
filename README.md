# 在线元数据插件（歌词 + 封面）

聚合多个平台自动获取歌词和封面，支持网易云、酷狗、QQ音乐、酷我、咪咕 + LRClib 六大音源。插件通过服务端歌词提供者回调机制注册，由主程序在需要时自动调用，同时支持播放时自动获取。

## 安装

1. 下载最新的 `lyrics.jsplugin.zip`
2. 放入 Songloft 的 `data/jsplugins/` 目录
3. 重启 Songloft

## 功能

- **多平台聚合搜索**：支持网易云、酷狗、QQ音乐、酷我、咪咕、LRClib 六大音源
- **智能匹配算法**：歌曲名相似度 + 歌手匹配 + 时长匹配，繁简体归一化，歌手不匹配扣分，nameSim < 0.2 硬性过滤
- **两步搜索策略**：先用「歌名 + 歌手」搜索，无匹配时自动用纯歌名重试
- **播放事件自动获取**：播放歌曲时自动搜索歌词和封面，利用完整 Song 元数据（album、duration、source_data）提高匹配精度
- **跳过已有歌词**：如果歌曲已有 `lyric_url` 或 `lyric_remote_url`，自动跳过
- **封面自动更新**：可选自动将获取到的封面写入歌曲
- **可配置优先级**：拖拽排序调整音源优先级，逐平台开关控制
- **详细诊断**：测试搜索时显示每个平台的搜索结果、匹配情况和错误信息
- **LRClib 自定义 API**：支持切换到自部署的 lrclib 兼容 API

## 音源说明

| 音源 | ID | 说明 |
|------|----|------|
| 网易云音乐 | `wy` | 公开 API，搜索和歌词获取稳定 |
| 酷狗音乐 | `kg` | 搜索 + Base64 解码歌词 |
| QQ音乐 | `tx` | 三级 API 降级（旧版 → 移动端 → 新版），支持加密歌词 |
| 酷我音乐 | `kw` | 单引号 JSON 解析，Web JSON 歌词 API（lrclist → LRC） |
| 咪咕音乐 | `mg` | 签名算法搜索，优先使用公开 CDN 歌词 URL |
| LRClib | `lrclib` | 国际歌词数据库，作为降级备选 |

## 使用

### 启用插件

安装后默认**未启用**。打开插件配置页面，勾选「启用插件」并保存。

### 音源管理

- **拖拽排序**：调整搜索优先级，排在前面的优先尝试
- **逐平台开关**：可单独启用/禁用某个音源
- **播放时自动获取**：开启后播放歌曲时自动搜索歌词和封面
- **自动更新封面**：开启后获取到封面时自动写入歌曲

### LRClib 配置

- **lrclib.net**（默认）：免费开放的歌词数据库
- **自定义 API**：填入兼容 lrclib API 格式的自定义地址

### 测试搜索

配置页面底部提供测试搜索功能，输入歌曲名和歌手后可查看每个平台的搜索结果、匹配歌曲和歌词获取情况。

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/lyric-search?title=...&artist=...&album=...&duration=...` | 歌词搜索（由主程序自动调用） |
| GET | `/cover-search?title=...&artist=...&album=...&duration=...` | 封面搜索 |
| GET | `/config` | 获取当前配置 |
| PUT | `/config` | 更新配置 |
| POST | `/config/reset` | 重置为默认配置 |
| GET | `/sources` | 获取可用音源列表和当前优先级 |
| GET | `/test-search?title=...&artist=...&album=...&duration=...` | 测试搜索（含逐平台诊断） |
| GET | `/` | 重定向到配置页面 |

## 项目结构

```
src/
├── main.ts              # 主入口：HTTP 路由、生命周期、歌词提供者注册
├── config.ts            # 配置管理（持久化存储、内存缓存）
├── types.ts             # 统一类型定义（MetadataConfig, MusicSource 等）
├── utils.ts             # 工具函数（智能匹配、繁简体归一化、HTTP 请求）
├── auto-fetch.ts        # 播放事件自动获取逻辑
├── lrclib.ts            # LRClib 音源实现
└── sources/
    ├── index.ts          # 音源聚合器（优先级调度、两步搜索）
    ├── wy/index.ts      # 网易云音乐
    ├── kg/index.ts      # 酷狗音乐
    ├── tx/index.ts      # QQ音乐
    ├── kw/index.ts      # 酷我音乐
    └── mg/index.ts      # 咪咕音乐
static/
└── index.html           # 配置页面
```

## 开发与构建

基于 `@songloft/plugin-sdk` 和 TypeScript 构建，运行在 QuickJS 沙盒中。

```bash
npm install
npm run dev       # watch + auto-upload to local Songloft
npm run build     # produce dist/lyrics.jsplugin.zip
```

## 技术要点

- **QuickJS 兼容**：不使用 `AbortController`、Node.js `crypto` 等浏览器/Node 专有 API
- **酷我单引号 JSON**：API 返回 Python 风格单引号 JSON，需 `parseKuwoJson()` 替换后解析
- **咪咕三维数组**：`resultList[group][song]` 嵌套结构，需循环展开
- **咪咕签名算法**：`md5(keyword + signatureMd5 + salt + deviceId + timestamp)`
- **QQ音乐多 API 降级**：旧版 → 移动端（iPhone UA）→ 新版 musicu.fcg

## 环境要求

- Songloft v2.6.0+

## 许可

Apache-2.0
