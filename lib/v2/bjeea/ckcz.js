const got = require('@/utils/got');
const cheerio = require('cheerio');
const { createDataList, baseUrl } = require('./utils');


module.exports = async (ctx) => {
    let out = [];

    const link = `${baseUrl}/html/ckcz/index.html`;
    const response = await got(link);
    const $ = cheerio.load(response.data);
    const dataList = $('.com-list');
    out = out.concat(createDataList('通知公告', dataList[0]));
    out = out.concat(createDataList('有关政策', dataList[1]));
    out = out.concat(createDataList('院校招生章程', dataList[2]));
    // 近期工作
    out = out.concat($('.show-pc .sub-bod .rc-ulist li').map(function() {
        const $$ = $(this);
        const title = '近期工作' + $$.find('a').text();
        const link = baseUrl + $$.find('a').attr('href');
        return {
            title, link,
        };
    }).get());


    ctx.state.data = {
        title: `北京教育考试院-成考成招`,
        link,
        item: out,
    };
};
