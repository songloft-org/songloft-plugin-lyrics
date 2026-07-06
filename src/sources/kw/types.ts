/**
 * 酷我音源类型定义
 */

/** 酷我搜索结果项 */
export interface KwSearchItem {
  /** 歌曲 rid */
  rid: string;
  /** 歌曲名 */
  name?: string;
  /** 歌手名 */
  artist?: string;
  /** 专辑名 */
  album?: string;
  /** 专辑ID */
  albumpic?: string;
  /** 时长（秒） */
  duration?: string;
  /** 歌曲格式 */
  format?: string;
  /** 其他标识 */
  musicrid?: string;
  /** 300x300 专辑图 */
  pic?: string;
}

/** 酷我搜索响应 */
export interface KwSearchResponse {
  /** 搜索结果列表 */
  abslist?: KwSearchItem[];
  /** 总数 */
  total?: string;
}

/** 酷我歌词响应 */
export interface KwLyricResponse {
  /** 加密歌词内容 */
  lrcl?: string;
  /** 加密歌词内容（可能为 Base64） */
  lrcx?: string;
  /** 状态 */
  status?: number;
  /** 歌词类型 */
  type?: string;
}
