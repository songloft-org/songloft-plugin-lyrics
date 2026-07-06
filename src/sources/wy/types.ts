/**
 * 网易云音源类型定义
 */

/** 网易云搜索结果项 */
export interface WySearchItem {
  /** 歌曲ID */
  id: number;
  /** 歌曲名 */
  name: string;
  /** 歌手列表 */
  artists?: WyArtist[];
  /** 歌手名（逗号分隔） */
  artistName?: string;
  /** 专辑 */
  album?: WyAlbum;
  /** 专辑名 */
  albumName?: string;
  /** 时长（毫秒） */
  duration?: number;
  /** 封面URL */
  picUrl?: string;
  /** 版权状态 */
  copyright: number;
}

/** 网易云歌手 */
export interface WyArtist {
  id: number;
  name: string;
}

/** 网易云专辑 */
export interface WyAlbum {
  id: number;
  name: string;
  picUrl?: string;
}

/** 网易云搜索响应 */
export interface WySearchResponse {
  result?: {
    songs?: WySearchItem[];
    songCount?: number;
  };
  code?: number;
}

/** 网易云歌词响应 */
export interface WyLyricResponse {
  lrc?: {
    lyric?: string;
  };
  tlyric?: {
    lyric?: string;
  };
  romalrc?: {
    lyric?: string;
  };
  yrc?: {
    lyric?: string;
  };
  code?: number;
}

/** 网易云歌曲详情响应 */
export interface WySongDetailResponse {
  songs?: WySongDetail[];
  code?: number;
}

/** 网易云歌曲详情 */
export interface WySongDetail {
  id: number;
  name: string;
  artists?: WyArtist[];
  album?: WyAlbum;
  duration?: number;
  /** YRC 逐字歌词标记 */
  yrc?: string;
}
