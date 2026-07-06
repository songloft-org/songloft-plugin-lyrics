/**
 * 共享工具函数
 * 提供编码、解码、哈希、格式化等通用功能
 * 兼容 QuickJS 沙盒环境
 */

// ============================================================
// Base64 编解码（QuickJS 可能不完全支持 btoa/atob）
// ============================================================

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: number[]): string {
  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const byte1 = bytes[i++];
    const byte2 = i < bytes.length ? bytes[i++] : 0;
    const byte3 = i < bytes.length ? bytes[i++] : 0;
    const enc1 = byte1 >> 2;
    const enc2 = ((byte1 & 0x03) << 4) | (byte2 >> 4);
    const enc3 = ((byte2 & 0x0F) << 2) | (byte3 >> 6);
    const enc4 = byte3 & 0x3F;
    result += BASE64_CHARS[enc1] + BASE64_CHARS[enc2];
    result += i - 2 < bytes.length ? BASE64_CHARS[enc3] : '=';
    result += i - 1 < bytes.length ? BASE64_CHARS[enc4] : '=';
  }
  return result;
}

export function base64ToBytes(str: string): number[] {
  str = str.replace(/[\s\r\n]/g, '');
  const result: number[] = [];
  let i = 0;
  while (i < str.length) {
    const c1 = BASE64_CHARS.indexOf(str[i++]);
    const c2 = BASE64_CHARS.indexOf(str[i++]);
    const c3 = str[i] !== '=' ? BASE64_CHARS.indexOf(str[i++]) : 0;
    const c4 = str[i] !== '=' ? BASE64_CHARS.indexOf(str[i++]) : 0;
    if (c1 === -1 || c2 === -1) break;
    result.push((c1 << 2) | (c2 >> 4));
    if (c3 !== -1 && str[i - 2] !== '=') {
      result.push(((c2 & 0x0F) << 4) | (c3 >> 2));
    }
    if (c4 !== -1 && str[i - 1] !== '=') {
      result.push(((c3 & 0x03) << 6) | c4);
    }
  }
  return result;
}

export function stringToBase64(str: string): string {
  return bytesToBase64(utf8Encode(str));
}

export function base64ToString(str: string): string {
  return utf8Decode(base64ToBytes(str));
}

// ============================================================
// UTF-8 编解码
// ============================================================

export function utf8Encode(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
    } else if (code >= 0xD800 && code <= 0xDBFF) {
      const hi = code;
      const lo = str.charCodeAt(++i);
      code = ((hi - 0xD800) << 10) + (lo - 0xDC00) + 0x10000;
      bytes.push(
        0xF0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3F),
        0x80 | ((code >> 6) & 0x3F),
        0x80 | (code & 0x3F),
      );
    } else {
      bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
    }
  }
  return bytes;
}

export function utf8Decode(bytes: number[]): string {
  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const b1 = bytes[i++];
    if (b1 < 0x80) {
      result += String.fromCharCode(b1);
    } else if ((b1 & 0xE0) === 0xC0) {
      result += String.fromCharCode(((b1 & 0x1F) << 6) | (bytes[i++] & 0x3F));
    } else if ((b1 & 0xF0) === 0xE0) {
      result += String.fromCharCode(
        ((b1 & 0x0F) << 12) | ((bytes[i++] & 0x3F) << 6) | (bytes[i++] & 0x3F),
      );
    } else if ((b1 & 0xF8) === 0xF0) {
      const code =
        ((b1 & 0x07) << 18) |
        ((bytes[i++] & 0x3F) << 12) |
        ((bytes[i++] & 0x3F) << 6) |
        (bytes[i++] & 0x3F);
      const hi = ((code - 0x10000) >> 10) + 0xD800;
      const lo = ((code - 0x10000) & 0x3FF) + 0xDC00;
      result += String.fromCharCode(hi, lo);
    }
  }
  return result;
}

// ============================================================
// XOR 运算
// ============================================================

export function xorDecrypt(data: number[], key: number[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    result.push(data[i] ^ key[i % key.length]);
  }
  return result;
}

// ============================================================
// 查询字符串拼接（QuickJS URLSearchParams 兼容）
// ============================================================

export function buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const parts: string[] = [];
  for (const key in params) {
    const val = params[key];
    if (val === undefined || val === null) continue;
    parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(val)));
  }
  return parts.join('&');
}

export function appendQuery(url: string, params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = buildQueryString(params);
  if (!qs) return url;
  return url + (url.includes('?') ? '&' : '?') + qs;
}

// ============================================================
// 歌手名格式化
// ============================================================

export function cleanArtistName(name: string): string {
  if (!name) return '';
  return name
    .replace(/\s*\(feat\.\s*[^)]+\)/gi, '')
    .replace(/\s*（feat\.\s*[^）]+）/gi, '')
    .replace(/\s*ft\.\s*/gi, '')
    .replace(/\s*[,&、/]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildSearchKeyword(name: string, artist: string): string {
  const cleanName = (name || '').trim();
  const cleanArtist = cleanArtistName(artist || '');
  if (cleanArtist) {
    return cleanName + ' ' + cleanArtist;
  }
  return cleanName;
}

// ============================================================
// 时长匹配
// ============================================================

export function durationDiff(a: number, b: number): number {
  return Math.abs(a - b) / 1000;
}

export function isDurationMatch(a: number, b: number, tolerance: number = 3): boolean {
  return durationDiff(a, b) <= tolerance;
}

// ============================================================
// 繁简体转换（QuickJS 兼容，无依赖）
// ============================================================

/** 常用繁简体映射（覆盖歌词匹配中最常见的字） */
const S2T_MAP: Record<string, string> = {
  '苹': '蘋', '果': '果', '颗': '顆', '个': '個', '与': '與', '对': '對',
  '这': '這', '那': '那', '说': '說', '听': '聽', '唱': '唱', '爱': '愛',
  '梦': '夢', '风': '風', '云': '雲', '雨': '雨', '花': '花', '天': '天',
  '地': '地', '人': '人', '你': '妳', '他': '他', '她': '她', '我': '我',
  '无': '無', '时': '時', '为': '為', '来': '來', '去': '去', '过': '過',
  '还': '還', '会': '會', '要': '要', '在': '在', '的': '的', '是': '是',
  '不': '不', '有': '有', '和': '和', '也': '也', '了': '了', '么': '麼',
  '什': '什', '后': '後', '里': '裏', '开': '開', '关': '關', '长': '長',
  '门': '門', '问': '問', '间': '間', '从': '從', '进': '進', '远': '遠',
  '当': '當', '动': '動', '万': '萬', '千': '千', '心': '心', '手': '手',
  '日': '日', '月': '月', '星': '星', '夜': '夜', '年': '年', '华': '華',
  '东': '東', '学': '學', '实': '實', '书': '書', '现': '現', '发': '發',
  '点': '點', '线': '線', '头': '頭', '黑': '黑', '给': '給', '让': '讓',
  '路': '路', '面': '面', '马': '馬', '车': '車', '鸟': '鳥', '鱼': '魚',
  '乐': '樂', '钟': '鐘', '铁': '鐵', '银': '銀', '钱': '錢', '难': '難',
  '边': '邊', '红': '紅', '绿': '綠', '蓝': '藍', '体': '體', '离': '離',
  '别': '別', '笑': '笑', '语': '語', '声': '聲', '飞': '飛', '气': '氣',
  '记': '記', '认': '認', '识': '識', '论': '論', '请': '請', '读': '讀',
  '谁': '誰', '调': '調', '快乐': '快樂', '永远': '永遠', '简单': '簡單',
  '约定': '約定', '温柔': '溫柔', '拥抱': '擁抱', '干净': '乾淨',
};

/** 常用繁体转简体映射 */
const T2S_MAP: Record<string, string> = {};
for (const [s, t] of Object.entries(S2T_MAP)) {
  T2S_MAP[t] = s;
}

/** 简体转繁体 */
function s2t(str: string): string {
  // 先尝试多字映射（如 快乐->快樂）
  for (const [s, t] of Object.entries(S2T_MAP)) {
    if (s.length > 1) str = str.split(s).join(t);
  }
  let result = '';
  for (const ch of str) {
    result += S2T_MAP[ch] || ch;
  }
  return result;
}

/** 繁体转简体 */
function t2s(str: string): string {
  // 先尝试多字映射
  for (const [t, s] of Object.entries(T2S_MAP)) {
    if (t.length > 1) str = str.split(t).join(s);
  }
  let result = '';
  for (const ch of str) {
    result += T2S_MAP[ch] || ch;
  }
  return result;
}

/**
 * 统一转为简体进行比较
 */
function normalizeChinese(str: string): string {
  return t2s(str).toLowerCase().trim();
}

// ============================================================
// 计算字符串相似度（改进版：支持中英文、繁简体、包含关系优先）
// ============================================================

/**
 * 计算两个字符串的相似度（0-1）
 * 改进：支持繁简体转换，优先判断包含关系
 */
export function similarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  const a = normalizeChinese(s1);
  const b = normalizeChinese(s2);
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  // 包含关系给予高相似度（繁简体归一化后比较）
  if (a.includes(b) || b.includes(a)) return 0.92;
  // 简化的编辑距离：计算公共字符比例
  const maxLen = Math.max(a.length, b.length);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    if (b.indexOf(a[i]) !== -1) matches++;
  }
  return matches / maxLen;
}

/**
 * 从搜索结果中选择最佳匹配项
 * 改进：歌手不匹配时大幅扣分，歌名子串包含时降低权重，从歌名提取歌手信息
 */
export function pickBestMatch(
  results: Array<{ name: string; artist: string; duration?: number }>,
  targetName: string,
  targetArtist: string,
  targetDuration?: number,
): any | null {
  if (!results || results.length === 0) return null;

  const hasArtist = targetArtist && targetArtist.trim().length > 0;
  const MIN_SCORE = hasArtist ? 30 : 10;

  let bestScore = -1;
  let bestItem: any = null;

  for (const item of results) {
    let score = 0;
    const nameSim = similarity(item.name, targetName);

    // 歌名必须有一定相似度才算有效匹配（低于此门槛则跳过，即使歌手匹配也不行）
    if (nameSim < 0.2) continue;

    // 名字匹配：精确匹配/子串匹配区分权重
    if (nameSim >= 0.95) score += 70;       // 几乎精确匹配
    else if (nameSim >= 0.7) score += 50;    // 高相似
    else if (nameSim >= 0.4) score += 30;
    else score += nameSim * 10;

    // 歌手匹配（检查 artist 字段 + 从歌名中提取歌手）
    const cleanItemArtist = cleanArtistName(item.artist);
    const artistSim = similarity(cleanItemArtist, cleanArtistName(targetArtist));
    // 从歌名中提取歌手信息（如 "五月天 Mayday【一颗苹果】"）
    let nameArtistSim = 0;
    if (hasArtist) {
      // 从搜索结果的歌名中检测是否包含目标歌手名
      const normalizedName = normalizeChinese(item.name);
      const normalizedTargetArtist = normalizeChinese(targetArtist);
      if (normalizedName.includes(normalizedTargetArtist)) {
        nameArtistSim = 0.85;
      }
    }
    const bestArtistSim = Math.max(artistSim, nameArtistSim);

    if (bestArtistSim >= 0.8) score += 35;      // 歌手高度匹配
    else if (bestArtistSim >= 0.5) score += 20;  // 歌手部分匹配
    else if (bestArtistSim > 0) score += bestArtistSim * 10;
    // 歌手完全不匹配且有目标歌手时扣 30 分（从20提到30）
    else if (hasArtist) score -= 30;

    // 时长匹配加分
    if (targetDuration && item.duration && isDurationMatch(targetDuration, item.duration, 5)) {
      score += 15;
    }

    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  // 如果最高分低于最低门槛，返回 null（不匹配任何结果）
  if (bestScore < MIN_SCORE) return null;
  return bestItem;
}

// ============================================================
// 安全的 JSON 解析
// ============================================================

export function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

// ============================================================
// 延迟工具
// ============================================================

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// HMAC-MD5 (简化版 - 使用 Go 桥接)
// ============================================================

export function md5(data: string): string {
  try {
    if (typeof __go_crypto_md5 === 'function') {
      return __go_crypto_md5(data);
    }
  } catch (e) {
    // 降级处理
  }
  songloft.log.warn('md5: Go 桥接不可用，使用占位实现');
  return simpleMd5(data);
}

function simpleMd5(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0').repeat(4);
}

// ============================================================
// AES 加密（通过 Go 桥接）
// ============================================================

export function aesEncrypt(plaintext: string, mode: string, key: string, iv: string): string {
  try {
    if (typeof __go_crypto_aes_encrypt === 'function') {
      const dataHex = bytesToHex(utf8Encode(plaintext));
      const keyHex = bytesToHex(utf8Encode(key));
      const ivHex = bytesToHex(utf8Encode(iv));
      return __go_crypto_aes_encrypt(dataHex, mode, keyHex, ivHex);
    }
  } catch (e) {
    // 降级
  }
  songloft.log.warn('aesEncrypt: Go 桥接不可用');
  return '';
}

// ============================================================
// zlib 解压（通过 Go 桥接）
// ============================================================

export function zlibInflate(data: number[]): number[] {
  try {
    if (typeof __go_zlib_inflate === 'function') {
      const inputHex = bytesToHex(data);
      const outputHex = __go_zlib_inflate(inputHex);
      if (outputHex && outputHex.length > 0) {
        return hexToBytes(outputHex);
      }
    }
  } catch (e) {
    // 降级
  }
  songloft.log.warn('zlibInflate: Go 桥接不可用，返回原始数据');
  return data;
}

// ============================================================
// 十六进制转换
// ============================================================

export function bytesToHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex: string): number[] {
  const result: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    result.push(parseInt(hex.substr(i, 2), 16));
  }
  return result;
}

// ============================================================
// 安全 fetch 包装
// 注意：QuickJS 的 fetch 是 Go 侧 goroutine 实现的真异步 fetch，
// 不支持 AbortController / signal。直接使用原生 fetch 即可。
// ============================================================

export async function safeFetch(url: string, options?: any, timeoutMs: number = 15000): Promise<Response> {
  // QuickJS 环境不支持 AbortController，直接使用 fetch
  return fetch(url, options);
}

export async function fetchJson<T = any>(url: string, options?: any, timeoutMs?: number): Promise<T> {
  const resp = await safeFetch(url, options, timeoutMs);
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${url.substring(0, 80)} body: ${text.substring(0, 200)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new Error(`JSON parse error: ${url.substring(0, 80)} body: ${text.substring(0, 200)}`);
  }
}

// ============================================================
// 常用 User-Agent
// ============================================================

export const UA = {
  browser: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  kugou: 'KuGou2012-9020-ExpandSearchManager',
  kuwo: 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36',
};
