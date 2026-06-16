/// <reference types="@songloft/plugin-sdk" />
import { createRouter, jsonResponse, parseQuery } from '@songloft/plugin-sdk';
import { searchLyrics } from './lrclib';
import { loadConfig, saveConfig, DEFAULT_CONFIG, type LyricsConfig } from './config';

const router = createRouter();

let registered = false;

function parseBody(req: HTTPRequest): any {
  if (!req.body) return {};
  const str = typeof req.body === 'string'
    ? req.body
    : String.fromCharCode.apply(null, Array.from(req.body as Uint8Array));
  return JSON.parse(str);
}

async function applyConfig(cfg: LyricsConfig): Promise<void> {
  if (cfg.enabled && !registered) {
    songloft.lyrics.registerProvider();
    registered = true;
    songloft.log.info('[lyrics] 歌词提供者已注册');
  } else if (!cfg.enabled && registered) {
    songloft.lyrics.unregisterProvider();
    registered = false;
    songloft.log.info('[lyrics] 歌词提供者已取消注册');
  }
}

// 后端 InvokeHTTP 调用此端点
router.get('/lyric-search', async (req: HTTPRequest) => {
  const cfg = await loadConfig();
  if (!cfg.enabled) {
    return jsonResponse({ error: 'lyrics search disabled' }, 503);
  }

  const q = parseQuery(req.query);
  const result = await searchLyrics(cfg, q.title || '', q.artist || '', q.album || '', parseFloat(q.duration) || 0);
  if (!result) {
    return jsonResponse(null, 404);
  }
  return jsonResponse(result);
});

router.get('/config', async () => {
  return jsonResponse(await loadConfig());
});

router.put('/config', async (req: HTTPRequest) => {
  const updates = parseBody(req);
  const current = await loadConfig();
  const merged: LyricsConfig = { ...current, ...updates };

  // 校验
  if (!['lrclib', 'custom'].includes(merged.provider)) {
    return jsonResponse({ error: 'provider 必须是 lrclib 或 custom' }, 400);
  }
  if (merged.provider === 'custom' && !merged.customUrl) {
    return jsonResponse({ error: 'custom provider 必须提供 customUrl' }, 400);
  }
  if (merged.provider === 'lrclib') {
    merged.customUrl = '';
  }

  await saveConfig(merged);
  await applyConfig(merged);
  return jsonResponse({ status: 'ok', config: merged });
});

// 测试搜索（用于配置页面验证）
router.get('/test-search', async (req: HTTPRequest) => {
  const cfg = await loadConfig();
  const q = parseQuery(req.query);
  const title = q.title || 'Bohemian Rhapsody';
  const artist = q.artist || 'Queen';
  const result = await searchLyrics(cfg, title, artist, '', 0);
  return jsonResponse({
    success: !!result,
    preview: result ? result.lyric : null,
  });
});

router.get('/', () => ({
  statusCode: 302,
  headers: { Location: 'static/index.html' },
  body: '',
}));

async function onInit(): Promise<void> {
  let cfg = await loadConfig();
  if (!cfg || typeof cfg.enabled === 'undefined') {
    cfg = { ...DEFAULT_CONFIG };
    await saveConfig(cfg);
  }
  await applyConfig(cfg);
}

async function onDeinit(): Promise<void> {
  if (registered) {
    songloft.lyrics.unregisterProvider();
    registered = false;
  }
}

globalThis.onInit = onInit;
globalThis.onDeinit = onDeinit;
globalThis.onHTTPRequest = (req: HTTPRequest) => router.handle(req);
