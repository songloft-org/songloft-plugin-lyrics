/**
 * LRClib 歌词搜索
 * 保留原版 lrclib API 客户端（精确+模糊搜索）
 * 作为 fallback 歌词源
 */

import { LyricResult, SongSearchResult, MusicSource } from './types';
import { fetchJson, safeJsonParse, buildQueryString, appendQuery } from './utils';

/** lrclib API 基础地址 */
const LRCLIB_BASE = 'https://lrclib.net/api';

/**
 * 通过 LRClib 搜索歌词
 * @param query 搜索关键词
 * @param duration 歌曲时长（可选，用于精确匹配）
 * @param artistName 歌手名（可选）
 * @param albumName 专辑名（可选）
 */
export async function searchLrcLib(
  query: string,
  duration?: number,
  artistName?: string,
  albumName?: string,
): Promise<any[]> {
  const params: Record<string, any> = {
    q: query,
  };
  if (duration && duration > 0) {
    params.duration = Math.round(duration);
  }
  if (artistName) {
    params.artist_name = artistName;
  }
  if (albumName) {
    params.album_name = albumName;
  }

  const url = appendQuery(`${LRCLIB_BASE}/search`, params);
  const resp = await fetchJson<any[]>(url, {
    headers: {
      'User-Agent': 'Songloft/1.0 (https://songloft.app)',
    },
  });

  // lrclib 返回的是数组
  if (Array.isArray(resp)) {
    return resp;
  }

  // 某些版本返回 { docs: [] } 格式
  if (resp && Array.isArray(resp.docs)) {
    return resp.docs;
  }

  return [];
}

/**
 * 获取指定 ID 的歌词
 */
export async function getLrcLibLyric(id: number): Promise<LyricResult> {
  const url = `${LRCLIB_BASE}/get/${id}`;
  const data = await fetchJson<any>(url, {
    headers: {
      'User-Agent': 'Songloft/1.0 (https://songloft.app)',
    },
  });

  return {
    lyric: data.syncedLyrics || data.plainLyrics || null,
    tlyric: null,
    rlyric: null,
    awlyric: null,
  };
}

/**
 * LRClib 音源实现
 */
export class LrcLibSource implements MusicSource {
  readonly id = 'lrclib';
  readonly name = 'LRClib';

  private baseUrl: string;

  constructor(customUrl?: string) {
    this.baseUrl = customUrl || LRCLIB_BASE;
  }

  async search(keyword: string, options?: { name?: string; artist?: string; album?: string; duration?: number }): Promise<SongSearchResult[]> {
    try {
      const results = await searchLrcLib(keyword, options?.duration, options?.artist, options?.album);

      return (results || []).slice(0, 10).map((item: any) => ({
        name: item.trackName || item.name || '',
        artist: item.artistName || item.artist || '',
        album: item.albumName || item.album || '',
        duration: item.duration ? item.duration * 1000 : 0,
        id: String(item.id),
        source: 'lrclib',
      }));
    } catch (e) {
      songloft.log.warn('LRClib 搜索失败', String(e));
      throw e;
    }
  }

  async getLyric(song: SongSearchResult): Promise<LyricResult> {
    try {
      return await getLrcLibLyric(parseInt(song.id));
    } catch (e) {
      songloft.log.warn('LRClib 获取歌词失败', String(e));
      return { lyric: null, tlyric: null, rlyric: null, awlyric: null };
    }
  }

  async getCover(song: SongSearchResult): Promise<{ coverUrl: string | null; source: string }> {
    // LRClib 不提供封面
    return { coverUrl: null, source: 'lrclib' };
  }
}
