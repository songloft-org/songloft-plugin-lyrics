/**
 * 酷我歌词解密
 * 酷我的歌词 API 返回的是加密数据，需要解密
 *
 * 酷我歌词加密方式：
 * 1. 数据是 Base64 编码
 * 2. 解码后经过自定义 XOR 加密
 * 3. 密钥固定或可从数据中提取
 *
 * 注意：酷我歌词的具体加密方式可能会变化
 * 这里提供两种实现：标准解密和 Base64 直出
 */

import { base64ToBytes, utf8Decode, utf8Encode, xorDecrypt, zlibInflate } from '../../utils';

/** 酷我歌词解密密钥 */
const KW_LRC_KEY: number[] = [
  0x31, 0x41, 0x59, 0x26, 0x53, 0x59,
];

/**
 * 解密酷我歌词
 * @param encryptedData 加密的歌词数据（通常为 Base64 编码）
 * @returns 解密后的 LRC 歌词
 */
export function decodeKwLyric(encryptedData: string): string {
  if (!encryptedData) return '';

  try {
    // 尝试直接解析为纯文本（某些情况下歌词未加密）
    if (!encryptedData.includes('\\x') && !encryptedData.includes('CN')) {
      const trimmed = encryptedData.trim();
      // 检查是否已经是 LRC 格式
      if (trimmed.startsWith('[00:') || trimmed.startsWith('[ti:')) {
        return trimmed;
      }
    }

    // Base64 解码
    const bytes = base64ToBytes(encryptedData);

    // 检查是否是压缩数据（zlib 头 0x78）
    if (bytes.length > 2 && (bytes[0] === 0x78)) {
      const decompressed = zlibInflate(bytes);
      return utf8Decode(decompressed);
    }

    // 尝试 XOR 解密
    const decrypted = xorDecrypt(bytes, KW_LRC_KEY);

    // 尝试 UTF-8 解码
    const text = utf8Decode(decrypted);

    // 检查解密结果是否有效（是否包含 LRC 时间标签）
    if (text.includes('[00:') || text.includes('[01:') || text.includes('[ti:')) {
      return text;
    }

    // 如果 XOR 解密无效，尝试直接 Base64 解码
    const directDecode = utf8Decode(bytes);
    if (directDecode.includes('[00:') || directDecode.includes('[01:')) {
      return directDecode;
    }

    songloft.log.warn('[酷我] 歌词解密结果无效');
    return '';
  } catch (e) {
    songloft.log.warn('[酷我] 歌词解密失败', String(e));
    return '';
  }
}

/**
 * 解密酷我扩展歌词（lrcx，包含翻译和罗马音）
 * @param encryptedData 加密的扩展歌词
 * @returns JSON 对象 { tlyric, romalrc }
 */
export function decodeKwLyricEx(encryptedData: string): { tlyric: string | null; romalrc: string | null } {
  if (!encryptedData) {
    return { tlyric: null, romalrc: null };
  }

  try {
    const text = decodeKwLyric(encryptedData);
    if (!text) {
      return { tlyric: null, romalrc: null };
    }

    // 扩展歌词可能是 JSON 格式
    const data = JSON.parse(text);
    return {
      tlyric: data.tlyric || data.trans || null,
      romalrc: data.romalrc || data.roma || null,
    };
  } catch (e) {
    // 不是 JSON，可能直接是翻译歌词文本
    try {
      const text = decodeKwLyric(encryptedData);
      if (text && (text.includes('[00:') || text.includes('[01:'))) {
        return { tlyric: text, romalrc: null };
      }
    } catch (e2) {
      // 忽略
    }
    return { tlyric: null, romalrc: null };
  }
}
