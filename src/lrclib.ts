import type { LyricsConfig } from './config';

interface LrcLibResult {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

interface LyricPayload {
  lyric: string;
  tlyric?: string;
  rlyric?: string;
  lxlyric?: string;
}

function getBaseUrl(cfg: LyricsConfig): string {
  if (cfg.provider === 'custom' && cfg.customUrl) {
    return cfg.customUrl.replace(/\/+$/, '');
  }
  return 'https://lrclib.net';
}

function toPayload(data: LrcLibResult): LyricPayload | null {
  const lyric = data.syncedLyrics || data.plainLyrics;
  if (!lyric) return null;
  return { lyric };
}

export async function searchLyrics(
  cfg: LyricsConfig,
  title: string,
  artist: string,
  album: string,
  duration: number,
): Promise<LyricPayload | null> {
  const baseUrl = getBaseUrl(cfg);
  const headers = { 'User-Agent': 'Songloft/1.0' };

  // 先尝试精确匹配
  if (title && artist) {
    try {
      const params = new URLSearchParams({
        track_name: title,
        artist_name: artist,
      });
      if (album) params.set('album_name', album);
      if (duration > 0) params.set('duration', String(Math.round(duration)));

      const resp = await fetch(`${baseUrl}/api/get?${params}`, { headers });
      if (resp.ok) {
        const data: LrcLibResult = await resp.json();
        const payload = toPayload(data);
        if (payload) {
          songloft.log.info(`[lyrics] 精确匹配成功: ${artist} - ${title}`);
          return payload;
        }
      }
    } catch (e: any) {
      songloft.log.warn(`[lyrics] 精确匹配失败: ${e.message || e}`);
    }
  }

  // 降级到模糊搜索
  try {
    const params = new URLSearchParams();
    if (title) params.set('track_name', title);
    if (artist) params.set('artist_name', artist);
    if (!params.toString()) return null;

    const resp = await fetch(`${baseUrl}/api/search?${params}`, { headers });
    if (!resp.ok) return null;

    const results: LrcLibResult[] = await resp.json();
    if (!results || results.length === 0) return null;

    // 优先选有同步歌词的结果
    const best = results.find((r) => r.syncedLyrics) || results[0];
    const payload = toPayload(best);
    if (payload) {
      songloft.log.info(`[lyrics] 模糊搜索匹配: ${best.artistName} - ${best.trackName}`);
    }
    return payload;
  } catch (e: any) {
    songloft.log.warn(`[lyrics] 模糊搜索失败: ${e.message || e}`);
    return null;
  }
}
