/**
 * 咪咕音源类型定义
 */

/** 咪咕搜索结果项 */
export interface MgSearchItem {
  /** 歌曲 ID */
  id: string;
  /** 歌曲名 */
  songName?: string;
  /** 歌手名 */
  singerName?: string;
  /** 专辑名 */
  albumName?: string;
  /** 专辑ID */
  albumId?: string;
  /** 时长（毫秒） */
  duration?: number;
  /** 封面URL */
  picUrl?: string;
  /** 歌词标识 */
  copyrightId?: string;
  /** LRC 歌词 URL */
  lrcUrl?: string;
  /** MRC 歌词 URL */
  mrcUrl?: string;
  /** TRC 翻译歌词 URL */
  trcUrl?: string;
}

/** 咪咕搜索响应 */
export interface MgSearchResponse {
  code: string;
  data?: {
    songResultList?: MgSearchItem[];
    songTotalCount?: number;
  };
}

/** 咪咕歌曲信息响应 */
export interface MgSongInfoResponse {
  code: string;
  data?: {
    songInfo?: MgSongInfo;
  };
}

/** 咪咕歌曲信息 */
export interface MgSongInfo {
  id: string;
  songName?: string;
  singerName?: string;
  albumName?: string;
  albumId?: string;
  /** 时长（毫秒） */
  duration?: number;
  /** 封面URL */
  picUrl?: string;
  /** LRC 歌词 URL */
  lrcUrl?: string;
  /** MRC 逐字歌词 URL */
  mrcUrl?: string;
  /** TRC 翻译歌词 URL */
  trcUrl?: string;
  /** 版权ID */
  copyrightId?: string;
}
