const got = require('@/utils/got');
const CryptoJS = require('crypto-js');
const logger = require('@/utils/logger');
const config = require('@/config').value;

let cachedCookies = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 缓存 5 分钟

/**
 * 从 CookieCloud 获取指定域名的 Cookie
 * @param {string} domain - 域名，例如 'douban.com'
 * @returns {Promise<string>} Cookie 字符串
 */
async function getCookieCloud(domain) {
    const { host, key, password } = config.cookiecloud || {};

    if (!host || !key || !password) {
        logger.debug('CookieCloud 配置不完整，跳过');
        return '';
    }

    try {
        // 检查缓存
        const now = Date.now();
        if (cachedCookies && now - lastFetchTime < CACHE_DURATION) {
            logger.debug('使用缓存的 CookieCloud 数据');
            return extractCookieForDomain(cachedCookies, domain);
        }

        // 从 CookieCloud 获取加密数据
        const url = `${host}/get/${key}`;
        logger.debug(`从 CookieCloud 获取 Cookie: ${url}`);

        const response = await got({
            method: 'get',
            url,
            headers: {
                'User-Agent': 'RSSHub/CookieCloud',
            },
        });

        if (!response.data || !response.data.encrypted) {
            logger.error('CookieCloud 返回数据格式错误');
            return '';
        }

        // 解密数据
        const decrypted = cookieDecrypt(key, response.data.encrypted, password);

        if (!decrypted || !decrypted.cookie_data) {
            logger.error('CookieCloud 解密失败');
            return '';
        }

        // 更新缓存
        cachedCookies = decrypted.cookie_data;
        lastFetchTime = now;

        logger.debug('成功从 CookieCloud 获取并解密 Cookie');
        return extractCookieForDomain(cachedCookies, domain);
    } catch (error) {
        logger.error(`从 CookieCloud 获取 Cookie 失败: ${error.message}`);
        return '';
    }
}

/**
 * 解密 CookieCloud 数据
 * @param {string} uuid - CookieCloud KEY
 * @param {string} encrypted - 加密的数据
 * @param {string} password - CookieCloud PASSWORD
 * @returns {object} 解密后的数据
 */
function cookieDecrypt(uuid, encrypted, password) {
    try {
        const theKey = CryptoJS.MD5(uuid + '-' + password)
            .toString()
            .substring(0, 16);
        const decrypted = CryptoJS.AES.decrypt(encrypted, theKey).toString(CryptoJS.enc.Utf8);
        return JSON.parse(decrypted);
    } catch (error) {
        logger.error(`CookieCloud 解密失败: ${error.message}`);
        return null;
    }
}

/**
 * 从 cookie_data 中提取指定域名的 Cookie
 * @param {object} cookieData - CookieCloud 返回的 cookie_data
 * @param {string} domain - 域名
 * @returns {string} Cookie 字符串
 */
function extractCookieForDomain(cookieData, domain) {
    if (!cookieData || !domain) {
        return '';
    }

    const cookies = [];

    // 遍历所有域名的 Cookie
    for (const [cookieDomain, domainCookies] of Object.entries(cookieData)) {
        // 检查域名是否匹配（支持子域名）
        if (domain.endsWith(cookieDomain) || cookieDomain.endsWith(domain)) {
            // 遍历该域名下的所有 Cookie
            for (const [path, pathCookies] of Object.entries(domainCookies)) {
                // CookieCloud 的数据结构中，cookieValue 可能是对象
                    cookies.push(`${pathCookies.name}=${pathCookies.value}`);
            }
        }
    }

    return cookies.join('; ');
}

module.exports = getCookieCloud;
