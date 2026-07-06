/**
 * QQ音乐音源类型定义
 */

/** QQ音乐搜索结果项 */
export interface TxSearchItem {
  /** 歌曲 mid */
  songmid: string;
  /** 歌曲名 */
  songname: string;
  /** 歌手名 */
  singer?: Array<{ name: string; mid: string }>;
  /** 专辑名 */
  albumname?: string;
  /** 专辑 mid */
  albummid?: string;
  /** 封面URL（120x120） */
  albumid?: number;
  /** 时长（秒） */
  interval?: number;
  /** 媒体 mid */
  strMediaMid?: string;
  /** 文件大小信息 */
  size128?: number;
  size320?: number;
  sizeflac?: number;
  /** 封面URL */
  albumpic?: string;
  /** picUrl */
  picUrl?: string;
}

/** QQ音乐搜索响应 */
export interface TxSearchResponse {
  code: number;
  data?: {
    song?: {
      list?: TxSearchItem[];
      totalnum?: number;
    };
  };
}

/** QQ音乐歌词响应 */
export interface TxLyricResponse {
  code: number;
  data?: {
    lyric?: string;
    trans?: string;
    roma?: string;
    qrc?: string;
  };
}

/** QQ音乐 unified API 请求体 */
export interface TxUniRequest {
  comm?: {
    ct?: number;
    cv?: string;
    tmeAppID?: number;
  };
  [key: string]: any;
}
