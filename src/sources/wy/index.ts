/**
 * 网易云音源
 * 使用公开 API（无需 eapi 加密）获取歌词
 */

import { LyricResult, SongSearchResult, MusicSource, CoverResult } from '../../types';
import { fetchJson, safeFetch, UA, safeJsonParse } from '../../utils';

/** 网易云公开 API */
const WY_API_BASE = 'https://music.163.com/api';

export class WangYiYunSource implements MusicSource {
  readonly id = 'wy';
  readonly name = '网易云';

  async search(keyword: string, options?: { name?: string; artist?: string; album?: string; duration?: number }): Promise<SongSearchResult[]> {
    try {
      const url = `${WY_API_BASE}/search/get/web?csrf_token=&s=${encodeURIComponent(keyword)}&type=1&offset=0&total=true&limit=10`;
      const resp = await fetchJson<any>(url, {
        headers: {
          'User-Agent': UA.browser,
          'Referer': 'https://music.163.com',
        },
      });

      const songs = resp?.result?.songs;
      if (!songs || !Array.isArray(songs)) {
        return [];
      }

      return songs.slice(0, 10).map((item: any) => ({
        name: item.name || '',
        artist: (item.artists || []).map((a: any) => a.name).join('/'),
        album: item.album?.name || '',
        duration: item.duration || 0,
        id: String(item.id),
        source: 'wy',
      }));
    } catch (e) {
      songloft.log.warn('[网易云] 搜索失败: ' + String(e));
      throw e;
    }
  }

  async getLyric(song: SongSearchResult): Promise<LyricResult> {
    try {
      // 使用网易云公开歌词 API（无需加密）
      const url = `${WY_API_BASE}/song/lyric?id=${song.id}&lv=1&tv=1&kv=1&yv=1&rv=1`;
      const json = await fetchJson<any>(url, {
        headers: {
          'User-Agent': UA.browser,
          'Referer': 'https://music.163.com',
        },
      });

      if (!json) {
        return { lyric: null, tlyric: null, rlyric: null, awlyric: null };
      }

      // 歌词可能在 lrc 或 uncategorized 中
      const lyric = json.lrc?.lyric || json.lyric || null;
      const tlyric = json.tlyric?.lyric || json.translateLyric || null;
      const romalrc = json.romalrc?.lyric || null;

      if (!lyric || lyric.trim().length === 0) {
        songloft.log.info('[网易云] 歌词为空');
        return { lyric: null, tlyric: null, rlyric: null, awlyric: null };
      }

      return {
        lyric,
        tlyric,
        rlyric: romalrc,
        awlyric: null,
      };
    } catch (e) {
      songloft.log.warn('[网易云] 获取歌词失败: ' + String(e));
      return { lyric: null, tlyric: null, rlyric: null, awlyric: null };
    }
  }

  async getCover(song: SongSearchResult): Promise<CoverResult> {
    try {
      const url = `${WY_API_BASE}/song/detail?ids=[${song.id}]`;
      const json = await fetchJson<any>(url, {
        headers: {
          'User-Agent': UA.browser,
          'Referer': 'https://music.163.com',
        },
      });

      const picUrl = json?.songs?.[0]?.album?.picUrl;
      if (picUrl) {
        return { coverUrl: picUrl + '?param=500y500', source: 'wy' };
      }

      return { coverUrl: null, source: 'wy' };
    } catch (e) {
      songloft.log.warn('[网易云] 获取封面失败: ' + String(e));
      return { coverUrl: null, source: 'wy' };
    }
  }
}
