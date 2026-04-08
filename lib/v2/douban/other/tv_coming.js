const { webcrypto } = require('node:crypto');

const got = require('@/utils/got');
const { parseDate } = require('@/utils/parse-date');

const apiUrl = 'https://frodo.douban.com/api/v2/tv/coming_soon';
const apiKey = '0dad551ec0f84ed02907ff5c42e8ec70';
const apiSecret = 'bf7dddc7c9cfe6f7';
const apiClientUa =
    'api-client/1 com.douban.frodo/7.22.0.beta9(231) Android/23 product/Mate 40 vendor/HUAWEI model/Mate 40 brand/HUAWEI rom/android network/wifi platform/AndroidPad';

const typeFilterMap = {
    all: {
        value: undefined,
        title: '全部',
    },
    show_domestic: {
        value: 'show_domestic',
        title: '国内综艺',
    },
    tv_animation: {
        value: 'tv_animation',
        title: '动画',
    },
    tv_american: {
        value: 'tv_american',
        title: '美剧',
    },
};

const sortByMap = {
    hot: 'hot',
    time: 'time',
};

const signRequest = async (url, ts, method = 'GET') => {
    const urlPath = new URL(url).pathname;
    const rawSign = `${method.toUpperCase()}&${encodeURIComponent(urlPath)}&${ts}`;
    const keyData = new TextEncoder().encode(apiSecret);
    const messageData = new TextEncoder().encode(rawSign);
    const key = await webcrypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const signature = await webcrypto.subtle.sign('HMAC', key, messageData);
    return Buffer.from(signature).toString('base64');
};

const getPubDateText = (pubdate) => pubdate?.[0];

const getPubDate = (pubdate) => {
    const pubDateText = getPubDateText(pubdate);
    if (!pubDateText) {
        return undefined;
    }

    const datePart = pubDateText.split('(')[0].trim();
    return parseDate(datePart);
};

const getSortTimestamp = (pubdate) => {
    const pubDateText = getPubDateText(pubdate);
    if (!pubDateText) {
        return Number.POSITIVE_INFINITY;
    }

    const datePart = pubDateText.split('(')[0].trim();
    const match = /^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/.exec(datePart);
    if (!match) {
        return Number.POSITIVE_INFINITY;
    }

    const year = Number.parseInt(match[1], 10);
    const month = match[2] ? Number.parseInt(match[2], 10) : 1;
    const day = match[3] ? Number.parseInt(match[3], 10) : 1;
    const timestamp = Date.UTC(year, month - 1, day);
    return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
};

const getWishCount = (wishCount) => {
    if (typeof wishCount === 'number') {
        return wishCount;
    }
    if (typeof wishCount === 'string') {
        const parsed = Number.parseInt(wishCount, 10);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
};

const renderDescription = (subject) => {
    const wishCount = getWishCount(subject.wish_count);
    const wishCountText = wishCount > 0 ? `想看人数：${wishCount}` : '';
    const introText = subject.intro ?? '';
    const pubDateText = getPubDateText(subject.pubdate);
    const genreText = Array.isArray(subject.genres) && subject.genres.length > 0 ? `类型：${subject.genres.join(' / ')}` : '';

    return [wishCountText, pubDateText ? `播出时间：${pubDateText}` : '', genreText, introText].filter(Boolean).join('<br>');
};

const parseRouteParams = (params) => {
    let typeFilter = 'all';
    let sortBy = 'hot';
    let requestCount = 10;

    for (const value of params.filter(Boolean)) {
        if (/^\d+$/.test(value)) {
            const parsed = Number.parseInt(value, 10);
            requestCount = Number.isNaN(parsed) || parsed <= 0 ? 10 : parsed;
            continue;
        }

        if (value === 'time') {
            sortBy = 'time';
            continue;
        }

        if (typeFilterMap[value]) {
            typeFilter = value;
            continue;
        }

        if (sortByMap[value]) {
            sortBy = sortByMap[value];
        }
    }

    return {
        typeFilter,
        sortBy,
        requestCount,
    };
};

const buildFetchError = (error) => {
    const status = error?.response?.status;
    if (status === 429) {
        return new Error('Douban 请求过于频繁（429），请稍后重试或降低抓取频率。');
    }
    if (status === 403) {
        return new Error('Douban 拒绝访问（403），可能触发反爬策略，请稍后重试。');
    }
    return new Error('Douban 数据请求失败，可能触发反爬或限频，请稍后重试。');
};

module.exports = async (ctx) => {
    const { typeFilter, sortBy, requestCount } = parseRouteParams([ctx.params.type_filter, ctx.params.sortBy, ctx.params.count]);
    const ts = new Date().toISOString().slice(0, 10).replaceAll('-', '');

    const searchParams = {
        count: requestCount,
        os_rom: 'android',
        apiKey,
        _ts: ts,
        _sig: await signRequest(apiUrl, ts),
    };
    if (sortBy !== 'time') {
        searchParams.sortby = sortBy;
    }
    if (typeFilterMap[typeFilter].value) {
        searchParams.type_filter = typeFilterMap[typeFilter].value;
    }

    const cacheKey = `douban:tv:coming:${typeFilter}:${requestCount}`;
    const data = await ctx.cache.tryGet(
        cacheKey,
        async () => {
            try {
                const response = await got({
                    method: 'get',
                    url: apiUrl,
                    searchParams,
                    headers: {
                        Accept: 'application/json',
                        'User-Agent': apiClientUa,
                    },
                });
                // eslint-disable-next-line no-console
                console.log(response.data);
                return response.data;
            } catch (error) {
                throw buildFetchError(error);
            }
        },
        1 * 60 * 60,
        false
    );

    if (!Array.isArray(data.subjects)) {
        const details = data.msg || data.message || data.reason;
        throw new Error(`Douban 返回数据结构异常，可能触发反爬或限频。${details ? `上游信息：${details}` : ''}`);
    }
    if (data.subjects.length === 0) {
        throw new Error('Douban 返回空数据，可能触发反爬或限频，请稍后重试。');
    }

    const sortedSubjects = [...data.subjects].sort((a, b) => {
        if (sortBy === 'time') {
            const timeDiff = getSortTimestamp(a.pubdate) - getSortTimestamp(b.pubdate);
            if (timeDiff !== 0) {
                return timeDiff;
            }
            return getWishCount(b.wish_count) - getWishCount(a.wish_count);
        }

        const wishDiff = getWishCount(b.wish_count) - getWishCount(a.wish_count);
        if (wishDiff !== 0) {
            return wishDiff;
        }
        return 0;
    });

    const typeFilterTitle = typeFilterMap[typeFilter].title;

    ctx.state.data = {
        title: `豆瓣剧集即将播出-${typeFilterTitle}`,
        link: 'https://movie.douban.com/tv/',
        description: `豆瓣剧集即将播出，分类：${typeFilterTitle}，排序：${sortBy}，返回数量：${data.count ?? 0}，总数：${data.total ?? 0}，请求数量：${requestCount}`,
        item: sortedSubjects.map((subject) => {
            const link = subject.url || subject.sharing_url || `https://movie.douban.com/subject/${subject.id}/`;
            const category = subject.card_subtitle ? [subject.card_subtitle] : subject.genres ?? [];
            const pubDate = sortBy === 'time' ? getPubDate(subject.pubdate) : undefined;
            const cover = subject.cover_url || subject.pic?.large;

            return {
                title: subject.title,
                category: category.length > 0 ? category : undefined,
                pubDate,
                description: [renderDescription(subject), cover ? `<img src="${cover}">` : ''].filter(Boolean).join('<br>'),
                link,
                guid: link,
            };
        }),
    };
};
