const cheerio = require('cheerio');
const { parseDate } = require('@/utils/parse-date');
const baseUrl = 'https://www.bjeea.cn';


function createDataList(pTitle, info) {
    return cheerio.load(info)('li').map(function() {
        const pushTime = cheerio.load(this)('.li-time').text();
        const itemLink = cheerio.load(this)('a');
        const title = itemLink.text().trim();
        const link = baseUrl + itemLink.attr('href');
        return {
            title: `${pTitle} - ${title}`,
            link,
            pubDate: parseDate(pushTime),
        };
    }).get();
}

module.exports = {
    createDataList,
    baseUrl,
};
