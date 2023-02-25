const got = require('@/utils/got');
const cheerio = require('cheerio');
const url = require('url');

const logger = require('@/utils/logger');


const host = 'https://www.douban.com/doulist/';

module.exports = async (ctx) => {
    const id = ctx.params.id;
    let out = [];
    let link = url.resolve(host, id);
    let isExixtPage = true;
    let title, description;
    do {
        const response = await got.get(link);
        const $ = cheerio.load(response.data);
        //    查看是否存在分页
        const nextPageUrl = $(".paginator> .thispage").next().attr('href');
        isExixtPage = nextPageUrl !== undefined;
        if (isExixtPage) {
            logger.info(`获取到下页链接:${nextPageUrl}`);
        }
        link = nextPageUrl;

        title = $('#content h1').text().trim();
        description = $('div.doulist-about').text().trim();
        const tempOut = $('div.doulist-item')
        .map(function () {
            const type = $(this).find('div.source').text().trim();

            let title = $(this).find('div.bd.doulist-note div.title a').text().trim();
            let link = $(this).find('div.bd.doulist-note div.title a').attr('href');
            let description = $(this).find('div.bd.doulist-note  div.abstract').text().trim();

            if (type === '来自：豆瓣广播') {
                title = $(this).find('p.status-content > a').text().trim();
                link = $(this).find('p.status-content a').attr('href');

                description = $(this).find('span.status-recommend-text').text().trim();
            }

            if (type === '来自：豆瓣电影' || type === '来自：豆瓣' || type === '来自：豆瓣读书' || type === '来自：豆瓣音乐') {
                title = $(this).find('div.bd.doulist-subject div.title a').text().trim();
                link = $(this).find('div.bd.doulist-subject div.title a').attr('href');

                description = $(this).find('div.bd.doulist-subject div.abstract').text().trim();

                const ft = $(this).find('div.ft div.comment-item.content').text().trim();

                const img = $(this).find('div.post a img').attr('src');

                description = '<div><img width="100" src="' + img + '"></div>' + description + '<blockquote>' + ft + '</blockquote>';
            }

            const date = $(this).find('div.ft div.actions time span').attr('title');

            const single = {
                title,
                link,
                description,
                pubDate: new Date(date).toUTCString(),
            };
            return single;
        })
        .get();
        out = out.concat(tempOut);
    } while (isExixtPage);
    ctx.state.data = {
        title,
        link,
        description,
        item: out,
    };
};
