/**
 * 酷狗音源类型定义
 */

/** 酷狗搜索结果 */
export interface KgSearchItem {
  /** 歌曲 hash */
  hash: string;
  /** 歌曲 ID */
  song_id: string;
  /** 歌曲名 */
  song_name: string;
  /** 歌手名（可能多个） */
  singer_name: string;
  /** 专辑名 */
  album_name?: string;
  /** 专辑 ID */
  album_id?: string;
  /** 时长（秒） */
  duration: number;
  /** 音频专辑ID（用于封面） */
  album_audio_id?: string;
  /** MV hash */
  mv_hash?: string;
  /** 320k hash */
  extra?: string;
  /** SQ hash */
  sqhash?: string;
}

/** 酷狗搜索响应 */
export interface KgSearchResponse {
  status?: number;
  error?: string;
  data?: {
    lists?: KgSearchItem[];
    total?: number;
  };
}

/** 酷狗歌词搜索响应 */
export interface KgLyricSearchResponse {
  status?: number;
  error?: string;
  candidates?: KgLyricSearchItem[];
  info?: any;
}

/** 酷狗歌词搜索项 */
export interface KgLyricSearchItem {
  /** 歌词ID */
  id: string;
  /** 歌词 accesskey */
  accesskey: string;
  /** 歌词类型: 'krc', 'lrc' */
  type?: string;
  /** 歌词格式: 'krc', 'lrc', 'txt' */
  fmt?: string;
  /** 歌词显示名 */
  lyric?: string;
  /** 匹配得分 */
  score?: number;
  /** 歌词作者 */
  artist?: string;
  /** 歌曲名 */
  song?: string;
  /** 频率 */
  frequency?: number;
}

/** 酷狗歌词下载响应 */
export interface KgLyricDownloadResponse {
  status?: number;
  error?: string;
  content?: string;
  fmt?: string;
  charset?: string;
  info?: any;
  /** KRC歌词（Base64编码） */
  krc?: string;
  /** LRC歌词 */
  lrc?: string;
  /** 翻译歌词（Base64编码KRC格式） */
  lrcx?: string;
}

/** 酷狗封面请求体 */
export interface KgCoverRequest {
  hash: string;
  album_audio_id: string;
  album_id: string;
  [[key: string]]: any;
}

/** 酷狗封面响应 */
export interface KgCoverResponse {
  status?: number;
  error?: string;
  data?: {
    url?: string;
    img?: string;
    [[key: string]]: any;
  };
}
