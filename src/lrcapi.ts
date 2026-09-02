import type { LyricsConfig } from './config';

interface LrcApiResult {
  id: string;
  title: string;
  artist: string;
  lyrics: string;
}

interface LyricPayload {
  lyric: string;
  tlyric?: string;
  rlyric?: string;
  lxlyric?: string;
}

export async function searchLyrics(
  cfg: LyricsConfig,
  title: string,
  artist: string,
  album: string,
): Promise<LyricPayload | null> {
  const baseUrl = cfg.lrcapiUrl.replace(/\/+$/, '');
  if (!baseUrl) return null;

  const headers: Record<string, string> = { 'User-Agent': 'Songloft/1.0' };
  if (cfg.lrcapiAuth) {
    headers['Authorization'] = cfg.lrcapiAuth;
  }

  try {
    const params = new URLSearchParams();
    if (title) params.set('title', title);
    if (artist) params.set('artist', artist);
    if (album) params.set('album', album);
    if (!params.toString()) return null;

    const resp = await fetch(`${baseUrl}/jsonapi?${params}`, { headers });
    if (!resp.ok) return null;

    const results: LrcApiResult[] = await resp.json();
    if (!results || results.length === 0) return null;

    const best = results.find((r) => r.lyrics) || results[0];
    if (!best.lyrics) return null;

    songloft.log.info(`[lyrics] LrcApi 匹配: ${best.artist} - ${best.title}`);
    return { lyric: best.lyrics };
  } catch (e: any) {
    songloft.log.warn(`[lyrics] LrcApi 搜索失败: ${e.message || e}`);
    return null;
  }
}
