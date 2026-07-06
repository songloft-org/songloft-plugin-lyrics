/**
 * MRC 歌词解密
 * MRC 是咪咕的加密歌词格式
 * 使用密钥异或解密
 */

import { base64ToBytes, utf8Decode, xorDecrypt, zlibInflate } from '../../utils';

/** MRC 解密密钥 */
const MRC_KEY: number[] = [
  0x23, 0x31, 0x34, 0x6C, 0x6A, 0x6B, 0x5F, 0x21,
  0x5C, 0x5D, 0x26, 0x30, 0x55, 0x3C, 0x27, 0x28,
];

/**
 * 解密 MRC 歌词
 * @param mrcData MRC 加密数据（可能是 Base64 编码或原始二进制）
 * @returns 解密后的 LRC 歌词
 */
export function decodeMrc(mrcData: string): string {
  if (!mrcData) return '';

  try {
    // Base64 解码
    const rawBytes = base64ToBytes(mrcData);
    if (rawBytes.length < 4) return '';

    // 检查是否是 zlib 压缩数据
    if (rawBytes[0] === 0x78 && rawBytes[1] === 0x9C) {
      const decompressed = zlibInflate(rawBytes);
      return utf8Decode(decompressed);
    }

    if (rawBytes[0] === 0x78 && rawBytes[1] === 0x01) {
      const decompressed = zlibInflate(rawBytes);
      return utf8Decode(decompressed);
    }

    // XOR 解密
    const decrypted = xorDecrypt(rawBytes, MRC_KEY);
    const text = utf8Decode(decrypted);

    // 检查是否是有效的歌词
    if (text.includes('[') && text.includes(']')) {
      return text;
    }

    // 尝试 zlib 解压（解密后可能是压缩数据）
    if (decrypted.length > 2 && decrypted[0] === 0x78) {
      const decompressed = zlibInflate(decrypted);
      return utf8Decode(decompressed);
    }

    songloft.log.warn('[咪咕] MRC 解密结果无效');
    return '';
  } catch (e) {
    songloft.log.warn('[咪咕] MRC 解密失败', String(e));
    return '';
  }
}

/**
 * 解密 TRC 翻译歌词（格式与 MRC 类似）
 */
export function decodeTrc(trcData: string): string {
  if (!trcData) return '';
  // TRC 使用与 MRC 相同的解密方式
  return decodeMrc(trcData);
}
