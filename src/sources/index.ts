/**
 * 音源聚合器
 * 管理所有音源实例，按配置的优先级顺序执行搜索
 */

import { MusicSource, SongSearchResult, LyricResult, CoverResult, MetadataConfig } from '../types';
import { LrcLibSource } from '../lrclib';
import { KuGouSource } from './kg';
import { KuWoSource } from './kw';
import { WangYiYunSource } from './wy';
import { QQMusicSource } from './tx';
import { MiguSource } from './mg';
import { buildSearchKeyword, pickBestMatch } from '../utils';

/** 所有可用的音源 */
export interface SourceRegistry {
  [sourceId: string]: MusicSource;
}

/**
 * 创建所有音源实例
 */
export function createSources(config?: MetadataConfig): SourceRegistry {
  const sources: SourceRegistry = {};

  // LRClib
  if (!config || config.sources.lrclib) {
    const lrclibUrl = config?.lrclib?.provider === 'custom' ? config.lrclib.customUrl : undefined;
    sources['lrclib'] = new LrcLibSource(lrclibUrl);
  }

  // 网易云
  if (!config || config.sources.wy) {
    sources['wy'] = new WangYiYunSource();
  }

  // 酷狗
  if (!config || config.sources.kg) {
    sources['kg'] = new KuGouSource();
  }

  // QQ音乐
  if (!config || config.sources.tx) {
    sources['tx'] = new QQMusicSource();
  }

  // 酷我
  if (!config || config.sources.kw) {
    sources['kw'] = new KuWoSource();
  }

  // 咪咕
  if (!config || config.sources.mg) {
    sources['mg'] = new MiguSource();
  }

  return sources;
}

/**
 * 按优先级获取排序后的音源列表
 */
export function getOrderedSources(config: MetadataConfig, sources: SourceRegistry): MusicSource[] {
  const priority = config.sourcePriority || ['wy', 'kg', 'tx', 'kw', 'mg', 'lrclib'];
  const ordered: MusicSource[] = [];

  for (const sourceId of priority) {
    if (sources[sourceId]) {
      ordered.push(sources[sourceId]);
    }
  }

  // 确保未在优先级列表中的音源也被添加
  for (const key in sources) {
    if (priority.indexOf(key) === -1) {
      ordered.push(sources[key]);
    }
  }

  return ordered;
}

/**
 * 多平台聚合搜索歌词
 * 按优先级顺序尝试各平台，返回第一个成功的结果
 *
 * @param config 配置
 * @param sources 音源注册表
 * @param name 歌曲名
 * @param artist 歌手名
 * @param album 专辑名（可选）
 * @param duration 时长（可选）
 * @param needCover 是否同时获取封面
 */
export async function aggregateSearchLyric(
  config: MetadataConfig,
  sources: SourceRegistry,
  name: string,
  artist: string,
  album?: string,
  duration?: number,
  needCover: boolean = false,
): Promise<{ lyric: LyricResult; cover: CoverResult | null; source: string }> {
  const ordered = getOrderedSources(config, sources);
  const keyword = buildSearchKeyword(name, artist);

  songloft.log.info(`开始多平台搜索歌词: "${keyword}"`);

  for (const source of ordered) {
    try {
      songloft.log.info(`尝试 [${source.name}] 搜索...`);

      // 搜索歌曲（优先使用 歌名+歌手 搜索）
      const results = await source.search(keyword, { name, artist, album, duration });
      if (!results || results.length === 0) {
        songloft.log.info(`[${source.name}] 无搜索结果`);
        continue;
      }

      // 选择最佳匹配
      let bestMatch = pickBestMatch(results, name, artist, duration);
      if (!bestMatch && artist) {
        // 带歌手搜索无匹配，尝试用纯歌名重新搜索
        songloft.log.info(`[${source.name}] 带歌手搜索无匹配，用纯歌名 "${name}" 重试`);
        const results2 = await source.search(name, { name, artist, album, duration });
        if (results2 && results2.length > 0) {
          bestMatch = pickBestMatch(results2, name, artist, duration);
        }
      }
      if (!bestMatch) {
        songloft.log.info(`[${source.name}] 无合适匹配 (共 ${results.length} 条结果)`);
        continue;
      }
      songloft.log.info(`[${source.name}] 匹配歌曲: ${bestMatch.name} - ${bestMatch.artist}`);

      // 获取歌词
      const lyric = await source.getLyric(bestMatch);
      if (!lyric || !lyric.lyric) {
        songloft.log.info(`[${source.name}] 无歌词`);
        continue;
      }

      songloft.log.info(`[${source.name}] 成功获取歌词 (${lyric.lyric.length} 字符)`);

      // 获取封面（如果需要）
      let cover: CoverResult | null = null;
      if (needCover) {
        try {
          cover = await source.getCover(bestMatch);
          if (cover?.coverUrl) {
            songloft.log.info(`[${source.name}] 成功获取封面: ${cover.coverUrl.substring(0, 60)}...`);
          }
        } catch (e) {
          songloft.log.warn(`[${source.name}] 获取封面失败`, String(e));
        }
      }

      return {
        lyric,
        cover,
        source: source.id,
      };
    } catch (e) {
      songloft.log.warn(`[${source.name}] 搜索过程出错`, String(e));
      continue;
    }
  }

  songloft.log.warn('所有平台均未找到歌词');
  return {
    lyric: { lyric: null, tlyric: null, rlyric: null, awlyric: null },
    cover: null,
    source: '',
  };
}

/**
 * 仅搜索封面（多平台）
 */
export async function aggregateSearchCover(
  config: MetadataConfig,
  sources: SourceRegistry,
  name: string,
  artist: string,
  album?: string,
  duration?: number,
): Promise<CoverResult | null> {
  const ordered = getOrderedSources(config, sources);
  const keyword = buildSearchKeyword(name, artist);

  // 跳过 lrclib（不支持封面）
  const coverSources = ordered.filter((s) => s.id !== 'lrclib');

  for (const source of coverSources) {
    try {
      songloft.log.info(`尝试 [${source.name}] 获取封面...`);

      const results = await source.search(keyword, { name, artist, album, duration });
      if (!results || results.length === 0) continue;

      const bestMatch = pickBestMatch(results, name, artist, duration);
      if (!bestMatch) continue;
      const cover = await source.getCover(bestMatch);

      if (cover?.coverUrl) {
        songloft.log.info(`[${source.name}] 成功获取封面`);
        return cover;
      }
    } catch (e) {
      songloft.log.warn(`[${source.name}] 获取封面出错`, String(e));
      continue;
    }
  }

  songloft.log.warn('所有平台均未找到封面');
  return null;
}
