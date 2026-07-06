/**
 * 插件自定义类型定义
 * 注意：SDK 类型（Song, HTTPRequest, HTTPResponse, PlayEvent 等）由 @songloft/plugin-sdk 提供
 * 这里只定义插件特有的类型
 */

/** 插件配置 */
export interface MetadataConfig {
  /** 总开关 */
  enabled: boolean;
  /** 播放时自动获取 */
  autoFetchOnPlay: boolean;
  /** 自动更新封面 */
  autoUpdateCover: boolean;
  /** 各音源启用状态 */
  sources: {
    lrclib: boolean;
    kg: boolean;
    kw: boolean;
    wy: boolean;
    tx: boolean;
    mg: boolean;
  };
  /** 平台优先级顺序 */
  sourcePriority: string[];
  /** lrclib 配置 */
  lrclib: {
    provider: 'lrclib' | 'custom';
    customUrl: string;
  };
}

/** 默认配置 */
export const DEFAULT_CONFIG: MetadataConfig = {
  enabled: true,
  autoFetchOnPlay: true,
  autoUpdateCover: true,
  sources: {
    lrclib: true,
    kg: true,
    kw: true,
    wy: true,
    tx: true,
    mg: true,
  },
  sourcePriority: ['wy', 'kg', 'tx', 'kw', 'mg', 'lrclib'],
  lrclib: {
    provider: 'lrclib',
    customUrl: '',
  },
};

/** 歌词结果（统一格式） */
export interface LyricResult {
  /** 原始歌词（LRC格式或纯文本） */
  lyric: string | null;
  /** 翻译歌词 */
  tlyric: string | null;
  /** 罗马音歌词 */
  rlyric: string | null;
  /** 音译歌词（awlyric/逐字歌词） */
  awlyric: string | null;
}

/** 歌曲搜索结果项 */
export interface SongSearchResult {
  /** 歌曲名称 */
  name: string;
  /** 歌手名 */
  artist: string;
  /** 专辑名 */
  album: string;
  /** 时长（毫秒） */
  duration: number;
  /** 平台内部ID */
  id: string;
  /** 音源标识 */
  source: string;
}

/** 封面获取结果 */
export interface CoverResult {
  /** 封面URL */
  coverUrl: string | null;
  /** 音源标识 */
  source: string;
}

/**
 * 音源接口——每个平台必须实现
 * 注意：这里的 search/getLyric/getCover 使用简单的参数，
 * 不依赖 Song 类型，以保持与各平台API的解耦
 */
export interface MusicSource {
  /** 音源标识 */
  readonly id: string;
  /** 音源名称 */
  readonly name: string;

  /**
   * 搜索歌曲
   * @param keyword 搜索关键词（通常为 "歌名 歌手名"）
   * @param options 可选，精确匹配信息
   */
  search(keyword: string, options?: SearchOptions): Promise<SongSearchResult[]>;

  /**
   * 获取歌词
   * @param song 搜索到的歌曲信息
   */
  getLyric(song: SongSearchResult): Promise<LyricResult>;

  /**
   * 获取封面
   * @param song 搜索到的歌曲信息
   */
  getCover(song: SongSearchResult): Promise<CoverResult>;
}

/** 搜索选项 */
export interface SearchOptions {
  name?: string;
  artist?: string;
  album?: string;
  duration?: number;
}

// ============================================================
// QuickJS 桥接函数声明（由 Songloft 运行时注入）
// ============================================================

/** MD5 哈希，输入 UTF-8 字符串，返回 hex 字符串 */
declare function __go_crypto_md5(str: string): string;
/** SHA256 哈希 */
declare function __go_crypto_sha256(str: string): string;
/** AES 加密 (cbc/ecb)，所有参数和返回值均为 hex */
declare function __go_crypto_aes_encrypt(dataHex: string, mode: string, keyHex: string, ivHex: string): string;
/** Buffer.from 桥接 */
declare function __go_buffer_from(data: string, encoding: string): string;
/** Buffer.toString 桥接 */
declare function __go_buffer_to_string(dataHex: string, encoding: string): string;
/** Zlib 解压，输入输出均为 hex */
declare function __go_zlib_inflate(dataHex: string): string;
