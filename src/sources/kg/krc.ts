/**
 * KRC 歌词解码
 * KRC 是酷狗的加密歌词格式
 * 解码流程: Base64转二进制 → 跳过4字节 → XOR密钥循环异或 → zlib解压
 *
 * 注意：zlib 解压需要 Go 桥接的 __go_zlib_inflate 函数支持
 * 如果桥接不可用，将降级为返回错误
 */

import { base64ToBytes, utf8Decode, xorDecrypt, zlibInflate, stringToBase64 } from '../../utils';

/** KRC 解密密钥 */
const KRC_KEY: number[] = [
  0x40, 0x47, 0x61, 0x77, 0x5e, 0x32, 0x74, 0x47,
  0x51, 0x36, 0x31, 0x2d, 0xce, 0xd2, 0x6e, 0x69,
];

/**
 * 解码 KRC 歌词（Base64 编码的 KRC 数据）
 * @param krcBase64 Base64 编码的 KRC 歌词数据
 * @returns 解码后的 LRC 格式歌词文本
 */
export function decodeKrc(krcBase64: string): string {
  try {
    // 1. Base64 解码为字节数组
    const rawBytes = base64ToBytes(krcBase64);
    if (rawBytes.length < 4) {
      throw new Error('KRC 数据太短');
    }

    // 2. 跳过前 4 字节（元数据头）
    const dataBytes = rawBytes.slice(4);

    // 3. XOR 密钥循环异或
    const decrypted = xorDecrypt(dataBytes, KRC_KEY);

    // 4. zlib 解压（需要 Go 桥接支持）
    const inflated = zlibInflate(decrypted);

    // 5. 转换为 UTF-8 字符串
    const krcText = utf8Decode(inflated);

    // 6. 解析 KRC 格式并转换为 LRC
    return parseKrcToLrc(krcText);
  } catch (e) {
    songloft.log.warn('KRC 解码失败', String(e));
    return '';
  }
}

/**
 * 解析 KRC 文本内容并转换为标准 LRC 格式
 * KRC 格式示例:
 *   [0:1000,0:2000]<0,0,0>歌词行1
 *   [0:3000,0:4000]<0,0,0>歌词行2
 *
 * 带逐字的格式:
 *   [0:1000,0:4000]<0,500,0>歌<500,500,0>词<1000,1000,0>行
 */
function parseKrcToLrc(krcText: string): string {
  const lines = krcText.split('\n');
  const lrcLines: string[] = [];
  const translationMap: Record<string, string> = {};
  const romaMap: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 解析 [language:base64] 标签（翻译和罗马音）
    const langMatch = trimmed.match(/^\[language:(\w+)\](.+)$/);
    if (langMatch) {
      const lang = langMatch[1];
      const content = langMatch[2];
      try {
        const data = JSON.parse(content);
        if (data && typeof data === 'object') {
          for (const key in data) {
            if (lang === 'translation' || lang === 'tlyric') {
              translationMap[key] = data[key];
            } else if (lang === 'roma' || lang === 'romalrc') {
              romaMap[key] = data[key];
            }
          }
        }
      } catch (e) {
        // 忽略解析错误
      }
      continue;
    }

    // 解析 KRC 时间标签和歌词内容
    // 格式: [startMs:endMs]<...>歌词内容
    const timeMatch = trimmed.match(/^\[(\d+):(\d+),(\d+):(\d+)\](.*)/);
    if (timeMatch) {
      const startMin = parseInt(timeMatch[1]);
      const startMs = parseInt(timeMatch[2]);
      const endMin = parseInt(timeMatch[3]);
      const endMs = parseInt(timeMatch[4]);
      const content = timeMatch[5];

      // 去除逐字标签，只保留纯歌词
      const lyricText = content.replace(/<\d+,\d+,\d+>/g, '').trim();
      if (!lyricText) continue;

      // 转换为 LRC 时间格式 [mm:ss.xx]
      const totalMs = startMin * 60000 + startMs;
      const minutes = Math.floor(totalMs / 60000);
      const seconds = Math.floor((totalMs % 60000) / 1000);
      const centis = Math.floor((totalMs % 1000) / 10);
      const timeTag = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}]`;

      lrcLines.push(timeTag + lyricText);
    }
  }

  // 如果有翻译歌词，追加翻译
  if (Object.keys(translationMap).length > 0) {
    // 尝试按原始顺序插入翻译
    for (const line of lines) {
      const timeMatch = line.trim().match(/^\[(\d+):(\d+),(\d+):(\d+)\]/);
      if (timeMatch) {
        const startMin = parseInt(timeMatch[1]);
        const startMs = parseInt(timeMatch[2]);
        const key = `${startMin}:${startMs}`;
        if (translationMap[key]) {
          const totalMs = startMin * 60000 + startMs;
          const minutes = Math.floor(totalMs / 60000);
          const seconds = Math.floor((totalMs % 60000) / 1000);
          const centis = Math.floor((totalMs % 1000) / 10);
          const timeTag = `[${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}]`;
          lrcLines.push(timeTag + translationMap[key]);
        }
      }
    }
  }

  return lrcLines.join('\n');
}

/**
 * 从 KRC 中提取翻译歌词
 * @param krcBase64 Base64 编码的 KRC 数据（通常是翻译用的 KRC）
 * @returns 翻译歌词文本（LRC 格式）
 */
export function decodeKrcTranslation(krcBase64: string): string {
  try {
    const rawBytes = base64ToBytes(krcBase64);
    if (rawBytes.length < 4) return '';
    const dataBytes = rawBytes.slice(4);
    const decrypted = xorDecrypt(dataBytes, KRC_KEY);
    const inflated = zlibInflate(decrypted);
    const krcText = utf8Decode(inflated);
    return parseKrcToLrc(krcText);
  } catch (e) {
    songloft.log.warn('KRC 翻译解码失败', String(e));
    return '';
  }
}
