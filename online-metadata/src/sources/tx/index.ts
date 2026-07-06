/**
 * QQ音乐音源
 *
 * 搜索尝试多个API端点，优先移动端接口
 * 歌词支持旧版 Base64 和新版明文返回
 */

import { LyricResult, SongSearchResult, MusicSource, CoverResult } from '../../types';
import { fetchJson, safeFetch, UA, safeJsonParse, base64ToString } from '../../utils';

const TX_SEARCH_URL = 'https://c.y.qq.com/soso/fcgi-bin/client_search_cp';
const TX_SEARCH_MOBILE_URL = 'https://c.y.qq.com/soso/fcgi-bin/search_for_qq_cp';
const TX_UNIFIED_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg';

export class QQMusicSource implements MusicSource {
  readonly id = 'tx';
  readonly name = 'QQ音乐';

  async search(keyword: string, options?: { name?: string; artist?: string; album?: string; duration?: number }): Promise<SongSearchResult[]> {
    // 如果有专辑信息，将专辑名加入搜索关键词提高精度
    const searchKeyword = options?.album ? `${keyword} ${options.album}` : keyword;

    // 尝试多个搜索端点
    const results = await this.searchOldApi(searchKeyword);
    if (results.length > 0) return results;

    const results2 = await this.searchMobileApi(searchKeyword);
    if (results2.length > 0) return results2;

    return this.searchNewApi(searchKeyword);
  }

  private async searchOldApi(keyword: string): Promise<SongSearchResult[]> {
    try {
      const url = `${TX_SEARCH_URL}?w=${encodeURIComponent(keyword)}&format=json&p=1&n=10`;
      const resp = await fetchJson<any>(url, {
        headers: {
          'User-Agent': UA.browser,
          'Referer': 'https://y.qq.com',
        },
      });

      const songList = resp?.data?.song?.list;
      if (!songList || !Array.isArray(songList)) return [];

      return songList.slice(0, 10).map((item: any) => ({
        name: item.songname || item.name || item.title || '',
        artist: (item.singer || []).map((s: any) => s.name).join('/'),
        album: item.albumname || item.album || '',
        duration: (item.interval || 0) * 1000,
        id: item.songmid || item.mid || String(item.songid) || '',
        source: 'tx',
        _extra: { albumMid: item.albummid || item.album?.mid || '' },
      }));
    } catch (e) {
      return [];
    }
  }

  private async searchMobileApi(keyword: string): Promise<SongSearchResult[]> {
    try {
      // 移动端接口，反爬较弱
      const url = `${TX_SEARCH_MOBILE_URL}?g_tk=5381&w=${encodeURIComponent(keyword)}&format=json&p=1&n=10`;
      const resp = await fetchJson<any>(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.38(0x18002626) NetType/WIFI Language/zh_CN',
          'Referer': 'https://y.qq.com',
        },
      });

      const songList = resp?.data?.song?.list || resp?.data?.item || resp?.song?.list;
      if (!songList || !Array.isArray(songList)) return [];

      return songList.slice(0, 10).map((item: any) => ({
        name: item.songname || item.name || item.title || '',
        artist: (item.singer || []).map((s: any) => s.name).join('/'),
        album: item.albumname || item.album || '',
        duration: (item.interval || 0) * 1000,
        id: item.songmid || item.mid || String(item.songid) || '',
        source: 'tx',
        _extra: { albumMid: item.albummid || item.album?.mid || '' },
      }));
    } catch (e) {
      return [];
    }
  }

  private async searchNewApi(keyword: string): Promise<SongSearchResult[]> {
    try {
      const payload = {
        "music.search.SearchCgiService": {
          method: "DoSearchForQQMusicDesktop",
          module: "music.search.SearchCgiService",
          param: {
            num_per_page: 10,
            page_num: 1,
            query: keyword,
            search_type: 0,
          }
        }
      };

      const url = `${TX_UNIFIED_URL}?data=${encodeURIComponent(JSON.stringify(payload))}`;
      const resp = await fetchJson<any>(url, {
        headers: {
          'User-Agent': UA.browser,
          'Referer': 'https://y.qq.com',
        },
      });

      const songList = resp?.['music.search.SearchCgiService']?.data?.body?.song?.list;
      if (!songList || !Array.isArray(songList)) {
        songloft.log.info('[QQ音乐] 搜索API无结果数据');
        return [];
      }

      return songList.slice(0, 10).map((item: any) => ({
        name: item.name || item.title || '',
        artist: (item.singer || []).map((s: any) => s.name).join('/'),
        album: item.album?.name || item.albumname || '',
        duration: (item.interval || 0) * 1000,
        id: item.mid || item.songmid || String(item.id) || '',
        source: 'tx',
        _extra: { albumMid: item.album?.mid || item.albummid || '' },
      }));
    } catch (e) {
      songloft.log.warn('[QQ音乐] 新版API也失败: ' + String(e));
      return [];
    }
  }

  async getLyric(song: SongSearchResult): Promise<LyricResult> {
    try {
      const mid = song.id;
      if (!mid) {
        return { lyric: null, tlyric: null, rlyric: null, awlyric: null };
      }

      // 先尝试旧版歌词 API
      const oldUrl = `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${mid}&g_tk=5381&format=json&incharset=utf8&outcharset=utf8`;
      try {
        const resp = await safeFetch(oldUrl, {
          headers: {
            'User-Agent': UA.browser,
            'Referer': 'https://y.qq.com',
          },
        });
        const text = await resp.text();

        // 可能是 JSONP，去除回调包装
        let jsonText = text;
        const jsonpMatch = text.match(/^\w+\((.*)\);?\s*$/s);
        if (jsonpMatch) {
          jsonText = jsonpMatch[1];
        }

        const data = safeJsonParse(jsonText);
        if (data?.lyric) {
          // Base64 解码
          let lyric = '';
          try {
            lyric = base64ToString(data.lyric);
          } catch (e) {
            lyric = data.lyric;
          }
          if (lyric && lyric.startsWith('[')) {
            let tlyric = '';
            if (data.tlyric) {
              try {
                tlyric = base64ToString(data.tlyric);
              } catch (e) {
                tlyric = data.tlyric;
              }
            }
            return { lyric, tlyric: tlyric || null, rlyric: null, awlyric: null };
          }
        }
      } catch (e) {
        songloft.log.info('[QQ音乐] 旧版歌词API失败: ' + String(e).substring(0, 60));
      }

      // 尝试新版歌词 API
      try {
        const payload = {
          "music.musichallSong.PlayLyricInfo": {
            method: "GetPlayLyricInfo",
            module: "music.musichallSong.PlayLyricInfo",
            param: {
              crypt: 1,
              ct: 19,
              cv: 1873,
              interval: 0,
              qrc: 1,
              roma: 1,
              songID: mid,
              trans: 1,
              type: -1,
            }
          }
        };

        const url = `${TX_UNIFIED_URL}?data=${encodeURIComponent(JSON.stringify(payload))}`;
        const resp = await fetchJson<any>(url, {
          headers: {
            'User-Agent': UA.browser,
            'Referer': 'https://y.qq.com',
          },
        });

        const lyricData = resp?.['music.musichallSong.PlayLyricInfo']?.data;
        if (lyricData?.lyric) {
          let lyric = lyricData.lyric;
          if (!lyric.startsWith('[')) {
            try { lyric = base64ToString(lyric); } catch (e) { /* keep original */ }
          }
          if (lyric.startsWith('[')) {
            return { lyric, tlyric: null, rlyric: null, awlyric: null };
          }
        }
      } catch (e) {
        songloft.log.info('[QQ音乐] 新版歌词API失败: ' + String(e).substring(0, 60));
      }

      songloft.log.info('[QQ音乐] 所有歌词API均失败');
      return { lyric: null, tlyric: null, rlyric: null, awlyric: null };
    } catch (e) {
      songloft.log.warn('[QQ音乐] 获取歌词失败: ' + String(e));
      return { lyric: null, tlyric: null, rlyric: null, awlyric: null };
    }
  }

  async getCover(song: SongSearchResult): Promise<CoverResult> {
    try {
      const albumMid = (song as any)._extra?.albumMid;
      if (albumMid) {
        return {
          coverUrl: `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumMid}.jpg`,
          source: 'tx',
        };
      }
      return { coverUrl: null, source: 'tx' };
    } catch (e) {
      songloft.log.warn('[QQ音乐] 获取封面失败: ' + String(e));
      return { coverUrl: null, source: 'tx' };
    }
  }
}
