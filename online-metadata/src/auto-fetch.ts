/**
 * 自动获取逻辑
 * 处理播放事件，自动搜索歌词和封面并更新到歌曲
 *
 * 改进：利用 Song 完整元数据（album, duration, year, isrc, source_data）
 * 提高匹配准确率，避免重复获取已有歌词
 */

import type { PlayEvent } from '@songloft/plugin-sdk';
import { MetadataConfig } from './types';
import { getConfig } from './config';
import { aggregateSearchLyric, aggregateSearchCover, createSources, type SourceRegistry } from './sources';

/** 防抖：避免短时间内重复获取同一首歌 */
const fetchCache: Map<string, number> = new Map();
/** 缓存有效期（毫秒） */
const CACHE_TTL = 5 * 60 * 1000;

/** 当前音源注册表 */
let currentSources: SourceRegistry | null = null;

export function initAutoFetch(config: MetadataConfig): void {
  currentSources = createSources(config);
  songloft.log.info('[online-metadata] 自动获取模块已初始化，已加载 ' + Object.keys(currentSources).length + ' 个音源');
}

export function reloadSources(config: MetadataConfig): void {
  currentSources = createSources(config);
  songloft.log.info('[online-metadata] 音源已重新加载');
}

/**
 * 尝试解析 source_data 获取更准确的信息
 */
function parseSourceData(sourceData: string | undefined): { title?: string; artist?: string; album?: string } {
  if (!sourceData) return {};
  try {
    const data = JSON.parse(sourceData);
    return {
      title: data.name || data.title || data.songName || undefined,
      artist: data.artist || data.singer || data.artists || undefined,
      album: data.album || data.albumName || undefined,
    };
  } catch (e) {
    return {};
  }
}

/**
 * 处理播放事件
 * 当播放新歌曲时，自动获取歌词和封面
 */
export async function handlePlayEvent(event: PlayEvent): Promise<void> {
  const config = getConfig();

  if (!config.enabled) return;
  if (event.type !== 'play') return;
  if (!config.autoFetchOnPlay) return;

  // 防抖
  const cacheKey = `${event.song.id}:${event.song.title}:${event.song.artist || ''}`;
  const lastFetch = fetchCache.get(cacheKey);
  if (lastFetch && (Date.now() - lastFetch) < CACHE_TTL) return;

  // 获取完整歌曲元数据
  let fullSong: any = null;
  try {
    fullSong = await songloft.songs.getById(event.song.id);
  } catch (e) {
    songloft.log.info('[online-metadata] 获取完整歌曲元数据失败，使用播放事件基本信息');
  }

  // 如果已有歌词URL，跳过获取
  if (fullSong?.lyric_url || fullSong?.lyric_remote_url) {
    songloft.log.info('[online-metadata] 歌曲已有歌词，跳过: ' + event.song.title);
    return;
  }

  // 优先使用完整元数据中的字段
  const sourceDataInfo = parseSourceData(fullSong?.source_data);

  const title = sourceDataInfo.title || fullSong?.title || event.song.title;
  const artist = sourceDataInfo.artist || fullSong?.artist || event.song.artist || '';
  const album = sourceDataInfo.album || fullSong?.album || '';
  const duration = fullSong?.duration || undefined;

  if (!title) {
    songloft.log.info('[online-metadata] 播放事件缺少歌曲名，跳过');
    return;
  }

  songloft.log.info(
    `[online-metadata] 播放事件触发自动获取: "${title}" - ${artist || '未知歌手'}` +
    (album ? ` [专辑: ${album}]` : '') +
    (duration ? ` [时长: ${Math.round(duration / 1000)}s]` : '')
  );

  if (!currentSources) {
    currentSources = createSources(config);
  }

  try {
    const result = await aggregateSearchLyric(
      config,
      currentSources,
      title,
      artist,
      album || undefined,
      duration,
      config.autoUpdateCover,
    );

    fetchCache.set(cacheKey, Date.now());

    if (result.lyric.lyric || (config.autoUpdateCover && result.cover?.coverUrl)) {
      const updateFields: Record<string, any> = {};

      if (result.lyric.lyric) {
        updateFields.lyric = result.lyric.lyric;
      }
      if (config.autoUpdateCover && result.cover?.coverUrl) {
        updateFields.coverUrl = result.cover.coverUrl;
      }

      try {
        await songloft.songs.update(event.song.id, updateFields);
        songloft.log.info(`[online-metadata] 已更新歌曲 "${title}" 的元数据 (${result.source || 'unknown'})`);
      } catch (e) {
        songloft.log.warn('[online-metadata] 更新歌曲元数据失败: ' + String(e));
      }
    } else {
      songloft.log.info(`[online-metadata] 未找到 "${title}" 的元数据`);
    }
  } catch (e) {
    songloft.log.error('[online-metadata] 自动获取过程出错: ' + String(e));
    fetchCache.set(cacheKey, Date.now());
  }
}
