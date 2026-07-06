/**
 * 酷我音源
 *
 * 搜索 API: search.kuwo.cn/r.s (返回单引号JSON，需要特殊解析)
 * 歌词 API: kuwo.cn/openapi/v1/www/lyric/getlyric (返回JSON格式，无需token)
 */

import { LyricResult, SongSearchResult, MusicSource, CoverResult } from '../../types';
import { safeFetch, fetchJson, UA, appendQuery } from '../../utils';

const KW_SEARCH_URL = 'https://search.kuwo.cn/r.s';
const KW_LYRIC_URL = 'https://kuwo.cn/openapi/v1/www/lyric/getlyric';
const KW_COVER_URL = 'https://artistpicserver.kuwo.cn/pic.web';

/**
 * 解析酷我返回的单引号JSON
 * 酷我API返回的是Python风格的单引号JSON，标准JSON.parse无法解析
 */
function parseKuwoJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch (e) {
    // 尝试替换单引号为双引号
    let fixed = text.replace(/'/g, '"');
    return JSON.parse(fixed);
  }
}

/**
 * 将秒数时间格式化为 LRC 时间标签 [mm:ss.xx]
 */
function formatTime(seconds: string): string {
  const s = parseFloat(seconds);
  if (isNaN(s) || s < 0) return '00:00.00';
  const min = Math.floor(s / 60);
  const sec = s - min * 60;
  return `${min.toString().padStart(2, '0')}:${sec.toFixed(2).padStart(5, '0')}`;
}

/**
 * 将酷我 JSON 歌词格式转换为标准 LRC 格式
 */
function convertToLrc(data: any): string {
  const lrclist = data?.lrclist;
  if (!lrclist || !Array.isArray(lrclist) || lrclist.length === 0) {
    return '';
  }

  const lines: string[] = [];
  let isInfo = true;

  for (const item of lrclist) {
    const text = (item.lineLyric || '').trim();
    const time = item.time || '0';

    // 识别元数据行（歌名、词曲作者等）
    if (isInfo && text.includes(' - ')) {
      // 可能是歌名行 "青花瓷 - 周杰伦 (Jay Chou)"
      const parts = text.split(' - ');
      if (parts.length === 2 && parts[1].includes('(')) {
        lines.push(`[ti:${parts[0]}]`);
        lines.push(`[ar:${parts[1].replace(/[\(\)]/g, '')}]`);
        continue;
      }
    }
    if (isInfo && (text.startsWith('词：') || text.startsWith('词:'))) {
      lines.push(`[au:${text.replace(/^词[：:]/, '')}]`);
      continue;
    }
    if (isInfo && (text.startsWith('曲：') || text.startsWith('曲:'))) {
      lines.push(`[by:${text.replace(/^曲[：:]/, '')}]`);
      continue;
    }
    if (isInfo && (text.startsWith('编曲：') || text.startsWith('编曲:'))) {
      isInfo = false;
      continue;
    }

    isInfo = false;

    // 普通歌词行
    if (text) {
      lines.push(`[${formatTime(time)}]${text}`);
    }
  }

  return lines.join('\n');
}

export class KuWoSource implements MusicSource {
  readonly id = 'kw';
  readonly name = '酷我';

  async search(keyword: string, options?: { name?: string; artist?: string; album?: string; duration?: number }): Promise<SongSearchResult[]> {
    try {
      // 如果有专辑信息，将专辑名加入搜索关键词提高精度
      const searchKeyword = options?.album ? `${keyword} ${options.album}` : keyword;
      const url = appendQuery(KW_SEARCH_URL, {
        all: searchKeyword,
        ft: 'music',
        rn: 10,
        pn: 1,
        rformat: 'json',
        encoding: 'utf8',
      });

      const resp = await safeFetch(url, {
        headers: { 'User-Agent': UA.kuwo },
      });
      const text = await resp.text();

      // 酷我返回单引号JSON，需要特殊解析
      const data = parseKuwoJson(text);
      const absList = data?.abslist;
      if (!absList || !Array.isArray(absList)) {
        songloft.log.info('[酷我] 搜索无结果 (abslist不存在)');
        return [];
      }

      return absList.slice(0, 10).map((item: any) => {
        const rid = item.MUSICRID || item.musicrid || item.RID || '';
        const id = String(rid).replace('MUSIC_', '').replace('music_', '');
        return {
          name: item.SONGNAME || item.songName || item.name || '',
          artist: String(item.ARTIST || item.artist || item.SINGER || item.singer || '').replace(/&/g, '/'),
          album: item.ALBUM || item.album || '',
          duration: parseInt(String(item.DURATION || item.duration || 0)) * 1000,
          id,
          source: 'kw',
        };
      });
    } catch (e) {
      songloft.log.warn('[酷我] 搜索失败: ' + String(e));
      return [];
    }
  }

  async getLyric(song: SongSearchResult): Promise<LyricResult> {
    try {
      // 使用酷我Web版公开JSON API（无需token）
      const url = appendQuery(KW_LYRIC_URL, {
        musicId: song.id,
        httpsStatus: '1',
        plat: 'web_www',
        from: '',
      });
      songloft.log.info('[酷我] 获取歌词: ' + url);

      const resp = await safeFetch(url, {
        headers: { 'User-Agent': UA.browser },
      });

      if (!resp.ok || resp.status !== 200) {
        songloft.log.info('[酷我] 歌词API返回非200: ' + resp.status);
        return { lyric: null, tlyric: null, rlyric: null, awlyric: null };
      }

      const text = await resp.text();
      if (!text) {
        return { lyric: null, tlyric: null, rlyric: null, awlyric: null };
      }

      try {
        const data = JSON.parse(text);
        if (data?.code !== 200 || !data?.data?.lrclist) {
          songloft.log.info('[酷我] 歌词API返回非成功: code=' + (data?.code) + ' msg=' + (data?.msg));
          return { lyric: null, tlyric: null, rlyric: null, awlyric: null };
        }

        // 转换为标准 LRC 格式
        const lrc = convertToLrc(data.data);
        if (lrc) {
          songloft.log.info('[酷我] 歌词获取成功，行数: ' + lrc.split('\n').length);
          return { lyric: lrc, tlyric: null, rlyric: null, awlyric: null };
        }
      } catch (e) {
        songloft.log.info('[酷我] 歌词JSON解析失败: ' + String(e).substring(0, 60));
      }

      return { lyric: null, tlyric: null, rlyric: null, awlyric: null };
    } catch (e) {
      songloft.log.warn('[酷我] 获取歌词失败: ' + String(e));
      return { lyric: null, tlyric: null, rlyric: null, awlyric: null };
    }
  }

  async getCover(song: SongSearchResult): Promise<CoverResult> {
    try {
      const url = appendQuery(KW_COVER_URL, {
        corp: 'kuwo',
        type: 'rid_pic',
        pictype: 500,
        size: 500,
        rid: song.id,
      });
      const resp = await safeFetch(url, {
        headers: { 'User-Agent': UA.kuwo },
      });
      const text = await resp.text();

      if (text && text.startsWith('http')) {
        let coverUrl = text.trim().replace('.kwcdn.kuwo.cn', '.kuwo.cn');
        if (coverUrl.startsWith('http://')) coverUrl = coverUrl.replace('http://', 'https://');
        return { coverUrl, source: 'kw' };
      }
      return { coverUrl: null, source: 'kw' };
    } catch (e) {
      songloft.log.warn('[酷我] 获取封面失败: ' + String(e));
      return { coverUrl: null, source: 'kw' };
    }
  }
}
