/// <reference types="@songloft/plugin-sdk" />
/**
 * songloft-plugin-online-metadata 主入口
 * 多平台歌词+封面自动获取插件
 *
 * 功能：
 * 1. 歌词提供者注册：主程序在歌曲无歌词时自动调用 /lyric-search
 * 2. 播放事件监听：播放歌曲时自动获取歌词和封面并更新到歌曲
 * 3. HTTP 路由：配置管理、手动搜索
 */

import { createRouter, jsonResponse, parseQuery } from '@songloft/plugin-sdk';
import type { HTTPRequest, HTTPResponse, PlayEvent } from '@songloft/plugin-sdk';
import { loadConfig, saveConfig, getConfig, updateConfig, resetConfig } from './config';
import { handlePlayEvent, initAutoFetch, reloadSources } from './auto-fetch';
import { aggregateSearchLyric, aggregateSearchCover, createSources } from './sources';
import { pickBestMatch } from './utils';

const router = createRouter();
let registered = false;

/** 解析请求体为对象 */
function parseBody(req: HTTPRequest): any {
  if (!req.body) return {};
  const str = typeof req.body === 'string'
    ? req.body
    : String.fromCharCode.apply(null, Array.from(req.body as Uint8Array));
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

/** 根据配置应用歌词提供者注册状态 */
async function applyProviderRegistration(): Promise<void> {
  const cfg = await loadConfig();
  if (cfg.enabled && !registered) {
    songloft.lyrics.registerProvider();
    registered = true;
    songloft.log.info('[online-metadata] 歌词提供者已注册');
  } else if (!cfg.enabled && registered) {
    songloft.lyrics.unregisterProvider();
    registered = false;
    songloft.log.info('[online-metadata] 歌词提供者已取消注册');
  }
}

// ============================================================
// HTTP 路由
// ============================================================

/**
 * GET /lyric-search - 服务端歌词搜索回调
 * 由主程序在歌曲无歌词时自动调用（通过 registerProvider）
 */
router.get('/lyric-search', async (req: HTTPRequest) => {
  // 使用 loadConfig() 确保获取最新配置
  const cfg = await loadConfig();
  if (!cfg.enabled) {
    return jsonResponse({ error: 'lyrics search disabled' }, 503);
  }

  const q = parseQuery(req.query);
  const title = q.title || '';
  const artist = q.artist || '';
  const album = q.album || '';
  const duration = parseFloat(q.duration) || 0;

  if (!title) {
    return jsonResponse({ error: 'title is required' }, 400);
  }

  songloft.log.info(`[online-metadata] 服务端歌词搜索: "${title}" - ${artist}`);

  const sources = createSources(cfg);
  const result = await aggregateSearchLyric(cfg, sources, title, artist, album, duration, false);

  if (!result.lyric.lyric) {
    songloft.log.info(`[online-metadata] 服务端搜索无结果: "${title}"`);
    return jsonResponse(null, 404);
  }

  songloft.log.info(`[online-metadata] 服务端搜索成功: "${title}" 来源: ${result.source}`);

  return jsonResponse({
    lyric: result.lyric.lyric,
    tlyric: result.lyric.tlyric || undefined,
    rlyric: result.lyric.rlyric || undefined,
    lxlyric: result.lyric.awlyric || undefined,
  });
});

/**
 * GET /cover-search - 手动搜索封面
 */
router.get('/cover-search', async (req: HTTPRequest) => {
  const cfg = getConfig();
  if (!cfg.enabled) {
    return jsonResponse({ error: 'plugin disabled' }, 503);
  }

  const q = parseQuery(req.query);
  const title = q.title || '';
  const artist = q.artist || '';
  const album = q.album || '';
  const duration = parseFloat(q.duration) || 0;

  if (!title) {
    return jsonResponse({ error: 'title is required' }, 400);
  }

  const sources = createSources(cfg);
  const result = await aggregateSearchCover(cfg, sources, title, artist, album, duration);

  if (!result?.coverUrl) {
    return jsonResponse(null, 404);
  }

  return jsonResponse({ coverUrl: result.coverUrl, source: result.source });
});

/**
 * GET /config - 获取当前配置
 */
router.get('/config', async () => {
  return jsonResponse(await loadConfig());
});

/**
 * PUT /config - 更新配置
 */
router.put('/config', async (req: HTTPRequest) => {
  try {
    const updates = parseBody(req);
    const current = await loadConfig();

    // 合并配置
    const merged = {
      ...current,
      ...updates,
      sources: { ...current.sources, ...(updates.sources || {}) },
      lrclib: { ...current.lrclib, ...(updates.lrclib || {}) },
    };

    // 校验 sourcePriority
    if (merged.sourcePriority && Array.isArray(merged.sourcePriority)) {
      const validSources = ['lrclib', 'wy', 'kg', 'tx', 'kw', 'mg'];
      merged.sourcePriority = merged.sourcePriority.filter((s: string) => validSources.includes(s));
      if (merged.sourcePriority.length === 0) {
        merged.sourcePriority = ['wy', 'kg', 'tx', 'kw', 'mg', 'lrclib'];
      }
    }

    await saveConfig(merged);

    // 重新加载音源
    reloadSources(merged);

    // 重新注册/取消注册歌词提供者
    await applyProviderRegistration();

    return jsonResponse({ status: 'ok', config: merged });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 400);
  }
});

/**
 * POST /config/reset - 重置配置
 */
router.post('/config/reset', async () => {
  const config = await resetConfig();
  reloadSources(config);
  await applyProviderRegistration();
  return jsonResponse({ status: 'ok', config });
});

/**
 * GET /test-search - 测试搜索（用于配置页面验证）
 * 返回每个平台的详细诊断信息
 */
router.get('/test-search', async (req: HTTPRequest) => {
  const cfg = getConfig();
  const q = parseQuery(req.query);
  const title = q.title || 'Bohemian Rhapsody';
  const artist = q.artist || 'Queen';
  const album = q.album || undefined;
  const duration = q.duration ? parseInt(q.duration) * 1000 : undefined;

  const sources = createSources(cfg);

  // 诊断结果收集
  const diagnostics: Array<{
    source: string;
    name: string;
    enabled: boolean;
    searchCount: number;
    matchName: string;
    matchArtist: string;
    lyricFound: boolean;
    error?: string;
  }> = [];

  const keyword = title + ' ' + artist;

  // 对每个启用的音源进行单独测试
  for (const sourceId of cfg.sourcePriority) {
    const source = sources[sourceId];
    if (!source) {
      diagnostics.push({
        source: sourceId,
        name: sourceId,
        enabled: false,
        searchCount: 0,
        matchName: '',
        matchArtist: '',
        lyricFound: false,
      });
      continue;
    }

    try {
      const results = await source.search(keyword);
      if (!results || results.length === 0) {
        diagnostics.push({
          source: sourceId,
          name: source.name,
          enabled: true,
          searchCount: 0,
          matchName: '',
          matchArtist: '',
          lyricFound: false,
        });
        continue;
      }

      // 选择最佳匹配（与自动获取接口一致：无匹配时用纯歌名重试）
      let match = pickBestMatch(results, title, artist, duration);
      if (!match && artist) {
        const results2 = await source.search(title);
        if (results2 && results2.length > 0) {
          match = pickBestMatch(results2, title, artist, duration);
        }
      }
      if (!match) {
        diagnostics.push({
          source: sourceId,
          name: source.name,
          enabled: true,
          searchCount: results.length,
          matchName: '(无匹配)',
          matchArtist: '',
          lyricFound: false,
        });
        continue;
      }
      let lyricFound = false;
      let lyricError = '';

      try {
        const lyricResult = await source.getLyric(match);
        lyricFound = !!lyricResult.lyric;
      } catch (e) {
        lyricError = String(e).substring(0, 100);
      }

      diagnostics.push({
        source: sourceId,
        name: source.name,
        enabled: true,
        searchCount: results.length,
        matchName: match.name,
        matchArtist: match.artist,
        lyricFound,
        error: lyricError || undefined,
      });
    } catch (e) {
      diagnostics.push({
        source: sourceId,
        name: source.name,
        enabled: true,
        searchCount: 0,
        matchName: '',
        matchArtist: '',
        lyricFound: false,
        error: String(e).substring(0, 100),
      });
    }
  }

  // 执行正常聚合搜索获取最终结果
  const result = await aggregateSearchLyric(cfg, sources, title, artist, '', 0, false);

  return jsonResponse({
    success: !!result.lyric.lyric,
    source: result.source,
    preview: result.lyric.lyric ? result.lyric.lyric.substring(0, 200) : null,
    diagnostics,
  });
});

/**
 * GET / - 重定向到配置页面
 */
router.get('/', () => ({
  statusCode: 302,
  headers: { Location: 'static/index.html' },
  body: '',
}));

/**
 * GET /sources - 获取可用音源列表和当前优先级
 */
router.get('/sources', async () => {
  const cfg = getConfig();
  const sources = createSources(cfg);
  const sourceList: Array<{ id: string; name: string; enabled: boolean }> = [];

  for (const id of ['lrclib', 'wy', 'kg', 'tx', 'kw', 'mg']) {
    sourceList.push({
      id,
      name: sources[id]?.name || id,
      enabled: !!sources[id],
    });
  }

  return jsonResponse({
    sources: sourceList,
    priority: cfg.sourcePriority,
    autoFetchOnPlay: cfg.autoFetchOnPlay,
    autoUpdateCover: cfg.autoUpdateCover,
  });
});

// ============================================================
// 插件生命周期
// ============================================================

async function onInit(): Promise<void> {
  songloft.log.info('[online-metadata] 插件初始化...');

  // 加载配置
  const config = await loadConfig();

  // 初始化自动获取模块
  initAutoFetch(config);

  // 注册歌词提供者
  if (config.enabled) {
    songloft.lyrics.registerProvider();
    registered = true;
    songloft.log.info('[online-metadata] 歌词提供者已注册');
  }

  // 订阅播放事件（自动获取歌词+封面）
  songloft.events.onPlayEvent(async (event: PlayEvent) => {
    try {
      await handlePlayEvent(event);
    } catch (e) {
      songloft.log.error('[online-metadata] 播放事件处理异常: ' + String(e));
    }
  });

  songloft.log.info('[online-metadata] 插件初始化完成');
}

async function onDeinit(): Promise<void> {
  songloft.log.info('[online-metadata] 插件销毁');

  // 取消注册歌词提供者
  if (registered) {
    songloft.lyrics.unregisterProvider();
    registered = false;
  }

  // 取消播放事件订阅
  songloft.events.offPlayEvent();
}

// ============================================================
// 导出生命周期钩子到 globalThis
// ============================================================

globalThis.onInit = onInit;
globalThis.onDeinit = onDeinit;
globalThis.onHTTPRequest = (req: HTTPRequest): HTTPResponse | Promise<HTTPResponse> => {
  return router.handle(req);
};
