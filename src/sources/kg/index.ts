/**
 * 酷狗音源
 * 实现搜索、歌词获取（KRC解码+LRC fallback）、封面获取
 *
 * 注意：酷狗API返回的字段名通常为大写开头（如 SongName, SingerName, FileHash）
 */

import { LyricResult, SongSearchResult, MusicSource, CoverResult } from '../../types';
import { fetchJson, safeFetch, appendQuery, base64ToString, UA, safeJsonParse } from '../../utils';
import { decodeKrc, decodeKrcTranslation } from './krc';
import { KgSearchResponse, KgLyricSearchResponse, KgLyricDownloadResponse } from './types';

/** 酷狗搜索 API */
const KG_SEARCH_URL = 'https://songsearch.kugou.com/song_search_v2';
/** 酷狗歌词搜索 API */
const KG_LYRIC_SEARCH_URL = 'http://lyrics.kugou.com/search';
/** 酷狗歌词下载 API */
const KG_LYRIC_DOWNLOAD_URL = 'http://lyrics.kugou.com/download';
/** 酷狗封面 API */
const KG_COVER_URL = 'http://media.store.kugou.com/v1/get_res_privilege';

/**
 * 酷狗音源实现
 */
export class KuGouSource implements MusicSource {
  readonly id = 'kg';
  readonly name = '酷狗';

  async search(keyword: string, options?: { name?: string; artist?: string; album?: string; duration?: number }): Promise<SongSearchResult[]> {
    try {
      const url = appendQuery(KG_SEARCH_URL, {
        keyword: keyword,
        page: 1,
        pagesize: 10,
        platform: 'WebFilter',
      });

      const resp = await fetchJson<any>(url, {
        headers: {
          'User-Agent': UA.browser,
        },
      });

      // 酷狗API返回的字段名通常为大写开头
      const lists = resp?.data?.lists || resp?.data?.Lists;
      if (!lists || !Array.isArray(lists)) {
        songloft.log.info('[酷狗] 搜索无结果');
        return [];
      }

      return lists.map((item: any) => {
        // 兼容大小写字段名
        const songName = item.SongName || item.song_name || item.songName || item.FileName || '';
        const singerName = item.SingerName || item.singer_name || item.singerName || '';
        const albumName = item.AlbumName || item.album_name || item.albumName || '';
        const duration = item.Duration || item.duration || 0;
        const fileHash = item.FileHash || item.file_hash || item.fileHash || item.hash || '';

        // 提取额外信息用于封面获取
        const albumId = item.AlbumID || item.album_id || item.albumId || '';
        const albumAudioId = item.AlbumAudioID || item.album_audio_id || item.albumAudioId || '';
        // 搜索结果直接包含封面URL模板: http://imge.kugou.com/stdmusic/{size}/xxx.jpg
        const imageUrl = item.Image || item.image || '';

        return {
          name: songName,
          artist: singerName.split('、').join('/'),
          album: albumName,
          duration: (duration) * 1000,
          id: fileHash,
          source: 'kg',
          _extra: { albumId, albumAudioId, imageUrl },
        };
      });
    } catch (e) {
      songloft.log.warn('[酷狗] 搜索失败: ' + String(e));
      throw e; // 重新抛出，让测试搜索能捕获错误信息
    }
  }

  async getLyric(song: SongSearchResult): Promise<LyricResult> {
    try {
      // 第一步：搜索歌词
      const lyricSearchUrl = appendQuery(KG_LYRIC_SEARCH_URL, {
        ver: 1,
        man: 'yes',
        client: 'pc',
        keyword: song.name + ' ' + song.artist,
        hash: song.id,
        timelength: Math.round(song.duration / 1000),
        lrctxt: 1,
      });

      const lyricSearchResp = await fetchJson<KgLyricSearchResponse>(lyricSearchUrl, {
        headers: {
          'KG-RC': '1',
          'KG-THash': 'expand_search_manager.cpp:852736169:451',
          'User-Agent': UA.kugou,
        },
      });

      const candidates = lyricSearchResp?.candidates;
      if (!candidates || candidates.length === 0) {
        songloft.log.info('[酷狗] 未找到歌词');
        return { lyric: null, tlyric: null, rlyric: null, awlyric: null };
      }

      // 选择最佳候选（优先 KRC 格式）
      const bestCandidate = candidates[0];
      const lyricId = bestCandidate.id;
      const accesskey = bestCandidate.accesskey;

      if (!lyricId || !accesskey) {
        return { lyric: null, tlyric: null, rlyric: null, awlyric: null };
      }

      // 第二步：下载歌词
      // 优先尝试 KRC 格式
      let lyric: string | null = null;
      let tlyric: string | null = null;

      try {
        const krcDownloadUrl = appendQuery(KG_LYRIC_DOWNLOAD_URL, {
          ver: 1,
          client: 'pc',
          id: lyricId,
          accesskey: accesskey,
          fmt: 'krc',
          charset: 'utf8',
        });

        const krcResp = await fetchJson<KgLyricDownloadResponse>(krcDownloadUrl, {
          headers: {
            'KG-RC': '1',
            'KG-THash': 'expand_search_manager.cpp:852736169:451',
            'User-Agent': UA.kugou,
          },
        });

        const krcContent = krcResp?.content || krcResp?.krc || '';
        if (krcContent) {
          lyric = decodeKrc(krcContent);
        }

        // 检查是否有翻译歌词（lrcx 也是 Base64 编码的 KRC）
        if (krcResp?.lrcx) {
          tlyric = decodeKrcTranslation(krcResp.lrcx);
        }
      } catch (e) {
        songloft.log.warn('[酷狗] KRC 下载/解码失败，尝试 LRC: ' + String(e));
      }

      // 如果 KRC 失败，降级到 LRC
      if (!lyric) {
        try {
          const lrcDownloadUrl = appendQuery(KG_LYRIC_DOWNLOAD_URL, {
            ver: 1,
            client: 'pc',
            id: lyricId,
            accesskey: accesskey,
            fmt: 'lrc',
            charset: 'utf8',
          });

          const lrcResp = await fetchJson<KgLyricDownloadResponse>(lrcDownloadUrl, {
            headers: {
              'KG-RC': '1',
              'KG-THash': 'expand_search_manager.cpp:852736169:451',
              'User-Agent': UA.kugou,
            },
          });

          const lrcContent = lrcResp?.content || lrcResp?.lrc || '';
          if (lrcContent) {
            // 酷狗 LRC 歌词的 content 是 Base64 编码的，需要解码
            // 但某些情况下可能已经是明文，先检查是否是 LRC 格式
            const trimmed = lrcContent.trim();
            if (trimmed.startsWith('[') || trimmed.startsWith('[ti:')) {
              lyric = lrcContent;
            } else {
              try {
                lyric = base64ToString(lrcContent);
              } catch (e) {
                lyric = lrcContent;
              }
            }
          }
        } catch (e2) {
          songloft.log.warn('[酷狗] LRC 下载也失败: ' + String(e2));
        }
      }

      return {
        lyric,
        tlyric,
        rlyric: null,
        awlyric: null,
      };
    } catch (e) {
      songloft.log.warn('[酷狗] 获取歌词失败: ' + String(e));
      return { lyric: null, tlyric: null, rlyric: null, awlyric: null };
    }
  }

  async getCover(song: SongSearchResult): Promise<CoverResult> {
    try {
      // 优先使用搜索结果中的 Image 字段（格式: http://imge.kugou.com/stdmusic/{size}/xxx.jpg）
      const imageUrl = (song as any)._extra?.imageUrl;
      if (imageUrl) {
        const coverUrl = imageUrl.replace('{size}', '500');
        songloft.log.info('[酷狗] 封面 (Image): ' + coverUrl);
        return { coverUrl, source: 'kg' };
      }

      // 备选1: 通过 media API 获取
      const searchUrl = appendQuery(KG_SEARCH_URL, {
        keyword: song.name + ' ' + song.artist,
        page: 1,
        pagesize: 1,
        platform: 'WebFilter',
      });

      const searchResp = await fetchJson<any>(searchUrl, {
        headers: {
          'User-Agent': UA.browser,
        },
      });

      const item = searchResp?.data?.lists?.[0];
      if (item) {
        // 尝试从二次搜索结果中取 Image 字段
        const imgFromSearch = item.Image || item.image;
        if (imgFromSearch) {
          const coverUrl = imgFromSearch.replace('{size}', '500');
          songloft.log.info('[酷狗] 封面 (Image from re-search): ' + coverUrl);
          return { coverUrl, source: 'kg' };
        }

        // 尝试 media API
        const hash = item.FileHash || item.file_hash || song.id;
        const albumId = item.AlbumID || item.album_id || '';
        const albumAudioId = item.AlbumAudioID || item.album_audio_id || '';

        const body = JSON.stringify({
          hash,
          album_audio_id: albumAudioId,
          album_id: albumId,
          is_mass: 0,
          preview: 0,
          privilege: 0,
          cmd: 25,
          behavior: 0,
        });

        const coverResp = await fetchJson<any>(KG_COVER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': UA.kugou,
          },
          body: 'data=' + encodeURIComponent(body),
        });

        const coverUrl = coverResp?.data?.url || coverResp?.data?.img;
        if (coverUrl) {
          songloft.log.info('[酷狗] 封面 (media API): ' + coverUrl);
          return { coverUrl, source: 'kg' };
        }

        // 备选2: 通过专辑ID拼接URL
        if (albumId) {
          const fallbackUrl = `https://img3.kugou.com/p/album_cover/500/${albumId}.jpg`;
          songloft.log.info('[酷狗] 封面 (albumId fallback): ' + fallbackUrl);
          return { coverUrl: fallbackUrl, source: 'kg' };
        }
      }

      return { coverUrl: null, source: 'kg' };
    } catch (e) {
      songloft.log.warn('[酷狗] 获取封面失败: ' + String(e));
      return { coverUrl: null, source: 'kg' };
    }
  }
}
