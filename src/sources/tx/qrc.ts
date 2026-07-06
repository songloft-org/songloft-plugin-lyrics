/**
 * QRC 歌词解码
 * QRC 是 QQ 音乐的加密歌词格式
 * 解码流程类似 KRC: Base64 → 去头部 → XOR → zlib 解压
 */

import { base64ToBytes, utf8Decode, xorDecrypt, zlibInflate } from '../../utils';

/** QRC 解密密钥 */
const QRC_KEY: number[] = [
  0x51, 0x52, 0x43, 0x33, 0x32, 0x5a, 0x4e, 0x34,
  0x44, 0x49, 0x36, 0x4C, 0x48, 0x59, 0x52, 0x47,
];

/**
 * 解码 QRC 歌词
 * @param qrcBase64 Base64 编码的 QRC 数据
 * @returns 解码后的 LRC 格式歌词
 */
export function decodeQrc(qrcBase64: string): string {
  if (!qrcBase64) return '';

  try {
    // 1. Base64 解码
    const rawBytes = base64ToBytes(qrcBase64);
    if (rawBytes.length < 8) {
      throw new Error('QRC 数据太短');
    }

    // 2. 跳过 QRC 文件头（前几个字节）
    // QRC 头格式: magic(4 bytes) + version + ...
    // 通常需要跳过前面的头部信息
    // 简化处理：跳过前 4 字节（类似 KRC）
    let dataStart = 4;
    // 检查是否有压缩标志
    if (rawBytes.length > 8 && rawBytes[4] === 0x78) {
      // 数据从偏移 5 开始可能直接是 zlib 数据
      dataStart = 5;
    }

    const dataBytes = rawBytes.slice(dataStart);

    // 3. XOR 解密
    const decrypted = xorDecrypt(dataBytes, QRC_KEY);

    // 4. zlib 解压
    const inflated = zlibInflate(decrypted);

    // 5. 转为 UTF-8 字符串
    const qrcText = utf8Decode(inflated);

    // 6. 解析 QRC 并转换为 LRC
    return parseQrcToLrc(qrcText);
  } catch (e) {
    songloft.log.warn('[QQ音乐] QRC 解码失败', String(e));
    return '';
  }
}

/**
 * 解析 QRC 文本并转换为 LRC 格式
 * QRC 格式: [offset:duration]content
 * 带逐字格式: [offset:duration]<offset,duration,0>字<...>词
 */
function parseQrcToLrc(qrcText: string): string {
  const lines = qrcText.split('\n');
  const lrcLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 解析 QRC 行格式
    // [开始偏移,持续时长]内容
    // 其中偏移和时长以毫秒为单位（可能是十进制整数）
    const match = trimmed.match(/^\[(\d+),(\d+)\](.*)/);
    if (match) {
      const startMs = parseInt(match[1]);
      const content = match[3];

      // 去除逐字标签
      const lyricText = content.replace(/<\d+,\d+,\d+>/g, '').trim();
      if (!lyricText) continue;

      // 转换为 LRC 时间格式
      const minutes = Math.floor(startMs / 60000);
      const seconds = Math.floor((startMs % 60000) / 1000);
      const centis = Math.floor((startMs % 1000) / 10);
      const timeTag = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}]`;

      lrcLines.push(timeTag + lyricText);
    }
  }

  return lrcLines.join('\n');
}
