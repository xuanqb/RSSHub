const got = require('@/utils/got');
const cheerio = require('cheerio');
const config = require('@/config').value;
const getCookieCloud = require('@/utils/cookiecloud');

module.exports = async (ctx) => {
    const groupid = ctx.params.groupid;
    const type = ctx.params.type;

    // 获取 Cookie：优先使用 CookieCloud，其次使用环境变量
    let cookie = config.douban.cookie || '';
    if (!cookie) {
        cookie = await getCookieCloud('douban.com');
    }

    const url = `https://www.douban.com/group/${groupid}/${type ? `?type=${type}` : ''}`;
    const response = await got({
        method: 'get',
        url,
        headers: {
            Cookie: cookie,
        },
    });

    const $ = cheerio.load(response.data);
    const list = $('.olt tr:not(.th)').slice(0, 10).get();

    const items = await Promise.all(
        list.map((item) => {
            const $1 = $(item);
            const result = {
                title: $1.find('.title a').attr('title'),
                author: $1.find('a').eq(1).text(),
                link: $1.find('.title a').attr('href'),
            };
            return ctx.cache.tryGet(result.link, async () => {
                try {
                    const detailResponse = await got({
                        method: 'get',
                        url: result.link,
                        headers: {
                            Cookie: cookie,
                        },
                    });
                    const $ = cheerio.load(detailResponse.data);

                    result.pubDate = $('.create-time').text();
                    result.description = $('.rich-content').html();
                    return result;
                } catch (error) {
                    return result;
                }
            });
        })
    );

    ctx.state.data = {
        title: `豆瓣小组-${$('h1').text().trim()}`,
        link: url,
        item: items,
    };
};
