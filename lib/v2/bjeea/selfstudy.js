const got = require('@/utils/got');
const cheerio = require('cheerio');
const {parseDate} = require("@/utils/parse-date");

const baseUrl = 'https://www.bjeea.cn'

function createDataList(pTitle, info) {
    return cheerio.load(info)('li').map(function () {
        const pushTime = cheerio.load(this)('.li-time').text()
        const itemLink = cheerio.load(this)('a')
        const title = itemLink.text().trim()
        const link = baseUrl + itemLink.attr('href')
        return {
            title: `${pTitle} - ${title}`,
            link,
            pubDate: parseDate(pushTime),
        };
    }).get()
}

module.exports = async (ctx) => {
    let out = [];

    const link = `${baseUrl}/html/selfstudy/index.html`
    const response = await got(link)
    const $ = cheerio.load(response.data);
    const dataList = $('.com-list')
    out = out.concat(createDataList('信息发布台', dataList[0]))
    out = out.concat(createDataList('自考政策', dataList[1]))


    ctx.state.data = {
        title: `北京教育考试院-自考自学`,
        link,
        item: out,
    };
};
