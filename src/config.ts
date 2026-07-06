/**
 * 配置管理
 * 负责从持久化存储读取/保存配置
 */

import { MetadataConfig, DEFAULT_CONFIG } from './types';

const STORAGE_KEY = 'online-metadata-config';

/** 当前配置（内存缓存） */
let currentConfig: MetadataConfig = { ...DEFAULT_CONFIG };

/**
 * 加载配置（从持久化存储）
 */
export async function loadConfig(): Promise<MetadataConfig> {
  try {
    const saved = await songloft.storage.get(STORAGE_KEY);
    if (saved && typeof saved === 'object') {
      // 合并默认配置，确保新增字段有默认值
      currentConfig = {
        ...DEFAULT_CONFIG,
        ...saved,
        sources: { ...DEFAULT_CONFIG.sources, ...(saved.sources || {}) },
        lrclib: { ...DEFAULT_CONFIG.lrclib, ...(saved.lrclib || {}) },
      };
      songloft.log.info('配置已加载', JSON.stringify(currentConfig));
      return currentConfig;
    }
  } catch (e) {
    songloft.log.warn('加载配置失败', String(e));
  }
  currentConfig = { ...DEFAULT_CONFIG };
  return currentConfig;
}

/**
 * 保存配置到持久化存储
 */
export async function saveConfig(config: MetadataConfig): Promise<void> {
  currentConfig = { ...config };
  try {
    await songloft.storage.set(STORAGE_KEY, config);
    songloft.log.info('配置已保存');
  } catch (e) {
    songloft.log.warn('保存配置失败', String(e));
  }
}

/**
 * 获取当前配置（内存中）
 */
export function getConfig(): MetadataConfig {
  return currentConfig;
}

/**
 * 更新部分配置字段
 */
export async function updateConfig(partial: Partial<MetadataConfig>): Promise<MetadataConfig> {
  currentConfig = {
    ...currentConfig,
    ...partial,
    sources: { ...currentConfig.sources, ...(partial.sources || {}) },
    lrclib: { ...currentConfig.lrclib, ...(partial.lrclib || {}) },
  };
  await saveConfig(currentConfig);
  return currentConfig;
}

/**
 * 重置配置为默认值
 */
export async function resetConfig(): Promise<MetadataConfig> {
  currentConfig = { ...DEFAULT_CONFIG };
  await saveConfig(currentConfig);
  return currentConfig;
}
