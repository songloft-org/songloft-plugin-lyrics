/**
 * 网易云 eapi 加密
 * 网易云音乐的 eapi 使用 AES-128-CBC 加密请求体
 *
 * 加密流程：
 * 1. 构建请求 JSON 字符串
 * 2. AES-128-CBC 加密（密钥: e82ckenh8dichen8, IV: 0102030405060708）
 * 3. 将加密结果转为 hex（eapi 使用 hex 格式传输）
 * 4. 计算 digest = MD5("nobodyusesintermediatekeys" + apiPath + version + os + text)
 *
 * 注意：AES 加密依赖 Go 桥接函数 __go_crypto_aes_encrypt
 */

import { md5, aesEncrypt, bytesToHex, utf8Encode } from '../../utils';

/** AES 密钥（16字节 ASCII） */
const EAPI_KEY = 'e82ckenh8dichen8';
/** AES IV（16字节 ASCII） */
const EAPI_IV = '0102030405060708';
/** 预共享密钥（cookie 中需要） */
const EAPI_COOKIE = 'os=pc;osver=Microsoft-Windows-10;appver=3.0.3.20171013;channel=netease;MOBILE_TERMINAL=false';
/** eapi 版本标识 */
const EAPI_VERSION = 'v1.6.16';
const EAPI_OS = 'pc';

/**
 * 构建 eapi 加密请求体
 * @param apiPath API 路径（如 /api/song/lyric/v1）
 * @param data 请求数据（对象）
 * @returns 加密后的请求配置 { cookie, body, header }
 */
export function buildEapiRequest(apiPath: string, data: any): { cookie: string; body: string; header: Record<string, string> } {
  // 1. 构建完整的请求 JSON
  const requestJson = {
    ...data,
    header: {
      ...(data.header || {}),
      requestId: Math.floor(Math.random() * 1000000000),
      clientVersion: '105001001',
      pluginVersion: [],
      securityLevel: 5,
      os: 'pc',
      osver: 'Windows 10',
      requestType: 0,
    },
  };

  const text = JSON.stringify(requestJson);

  // 2. AES-128-CBC 加密（通过 Go 桥接）
  const encryptedHex = aesEncrypt(text, 'cbc', EAPI_KEY, EAPI_IV);

  if (!encryptedHex) {
    songloft.log.error('[网易云] eapi AES 加密失败，Go 桥接不可用');
    return {
      cookie: EAPI_COOKIE,
      body: JSON.stringify({ params: '' }),
      header: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': EAPI_COOKIE,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://music.163.com',
      },
    };
  }

  // 3. 计算 digest
  const digestInput = 'nobody' + 'uses' + 'intermediate' + 'keys' + apiPath + EAPI_VERSION + EAPI_OS + text;
  // 注意：eapi 的 digest 不直接使用，但保留以兼容

  // 4. 构建 eapi body（hex 格式参数）
  const eapiData = {
    params: encryptedHex,
    e_r: false,
  };

  return {
    cookie: EAPI_COOKIE,
    body: JSON.stringify(eapiData),
    header: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': EAPI_COOKIE,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://music.163.com',
    },
  };
}
