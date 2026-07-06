/**
 * 咪咕音源
 *
 * 搜索 API: jadeite.migu.cn (需要签名)
 * 歌词: 使用 lyricUrl 或 lrcUrl (明文 LRC)
 *
 * 注意：resultList 是三维数组结构 resultList[i][j]，不是 resultList[i]
 */

import { LyricResult, SongSearchResult, MusicSource, CoverResult } from '../../types';
import { fetchJson, safeFetch, md5, UA, safeJsonParse, appendQuery } from '../../utils';

const MG_SEARCH_URL = 'https://jadeite.migu.cn/music_search/v3/search/searchAll';

/** 咪咕签名常量 */
const MG_DEVICE_ID = '963B7AA0D21511ED807EE5846EC87D20';
const MG_SIGNATURE_MD5 = '6cdc72a439cef99a3418d2a78aa28c73';

export class MiguSource implements MusicSource {
  readonly id = 'mg';
  readonly name = '咪咕';

  private createSign(time: string, keyword: string): string {
    const signStr = `${keyword}${MG_SIGNATURE_MD5}yyapp2d16148780a1dcc7408e06336b98cfd50${MG_DEVICE_ID}${time}`;
    return md5(signStr);
  }

  async search(keyword: string, options?: { name?: string; artist?: string; album?: string; duration?: number }): Promise<SongSearchResult[]> {
    try {
      // 如果有专辑信息，将专辑名加入搜索关键词提高精度
      const searchKeyword = options?.album ? `${keyword} ${options.album}` : keyword;
      const time = String(Date.now());
      const sign = this.createSign(time, searchKeyword);

      const searchSwitch = encodeURIComponent('{"song":1,"album":0,"singer":0,"tagSong":1,"mvSong":0,"bestShow":1,"songlist":0,"lyricSong":0}');
      const url = `${MG_SEARCH_URL}?isCorrect=0&isCopyright=1&searchSwitch=${searchSwitch}&pageSize=10&text=${encodeURIComponent(searchKeyword)}&pageNo=1&sort=0&sid=USS`;

      const resp = await fetchJson<any>(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; U; Android 11.0.0; zh-cn; MI 11 Build/OPR1.170623.032) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30',
          'uiVersion': 'A_music_3.6.1',
          'deviceId': MG_DEVICE_ID,
          'timestamp': time,
          'sign': sign,
          'channel': '0146921',
        },
      });

      if (resp?.code !== '000000') {
        songloft.log.info('[咪咕] 搜索返回错误码: ' + (resp?.code || 'unknown'));
        return [];
      }

      // resultList 是三维数组结构: resultList[group][song]
      const resultList = resp?.songResultData?.resultList;
      if (!resultList || !Array.isArray(resultList)) {
        songloft.log.info('[咪咕] 搜索无结果');
        return [];
      }

      // 展开三维数组为一维
      const songs: any[] = [];
      for (const group of resultList) {
        if (Array.isArray(group)) {
          for (const item of group) {
            if (item && typeof item === 'object') {
              songs.push(item);
            }
          }
        }
      }

      if (songs.length === 0) {
        songloft.log.info('[咪咕] 搜索无歌曲');
        return [];
      }

      return songs.slice(0, 10).map((item: any) => ({
        name: (item.songName || item.name || '').trim(),
        artist: (item.singerList || []).map((s: any) => s.name || '').join('/') || item.singer || '',
        album: item.album || item.albumName || '',
        duration: (item.duration || 0) * 1000,
        id: item.copyrightId || item.songId || item.contentId || item.id || '',
        source: 'mg',
        _extra: {
          lyricUrl: item.lyricUrl || '',
          lrcUrl: item.lrcUrl || '',
          mrcUrl: item.mrcUrl || '',
          trcUrl: item.trcUrl || '',
          img: item.img3 || item.img2 || item.img1 || null,
        },
      }));
    } catch (e) {
      songloft.log.warn('[咪咕] 搜索失败: ' + String(e));
      return [];
    }
  }

  async getLyric(song: SongSearchResult): Promise<LyricResult> {
    try {
      const extra = (song as any)._extra || {};
      // 咪咕有两个歌词URL字段：
      // lrcUrl -> d.musicapp.migu.cn （公开可访问，优先）
      // lyricUrl -> tyqk.migu.cn （内部CDN，经常不可达，降级）
      const urls = [extra.lrcUrl, extra.lyricUrl].filter(Boolean) as string[];

      for (const lyricUrl of urls) {
        if (!lyricUrl) continue;
        songloft.log.info('[咪咕] 获取歌词: ' + lyricUrl.substring(0, 80));
        try {
          const resp = await safeFetch(lyricUrl, {
            headers: { 'User-Agent': UA.browser },
          });
          const text = await resp.text();
          if (text && text.trim().startsWith('[')) {
            return { lyric: text.trim(), tlyric: null, rlyric: null, awlyric: null };
          }
          songloft.log.info('[咪咕] 歌词内容非LRC格式，前50: ' + (text || '').substring(0, 50));
        } catch (e) {
          songloft.log.info('[咪咕] 歌词URL失败，尝试下一个: ' + String(e).substring(0, 60));
        }
      }

      songloft.log.info('[咪咕] 无可用歌词URL');
      return { lyric: null, tlyric: null, rlyric: null, awlyric: null };
    } catch (e) {
      songloft.log.warn('[咪咕] 获取歌词失败: ' + String(e));
      return { lyric: null, tlyric: null, rlyric: null, awlyric: null };
    }
  }

  async getCover(song: SongSearchResult): Promise<CoverResult> {
    try {
      const img = (song as any)._extra?.img;
      if (img) {
        const coverUrl = img.startsWith('http') ? img : `http://d.musicapp.migu.cn${img}`;
        return { coverUrl, source: 'mg' };
      }
      return { coverUrl: null, source: 'mg' };
    } catch (e) {
      songloft.log.warn('[咪咕] 获取封面失败: ' + String(e));
      return { coverUrl: null, source: 'mg' };
    }
  }
}
