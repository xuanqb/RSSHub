const got = require('@/utils/got');
const cheerio = require('cheerio');
const {parseDate} = require('@/utils/parse-date');
const timezone = require('@/utils/timezone');

const apiServer = 'https://gw-c.nowcoder.com';
const host = 'https://www.nowcoder.com';

module.exports = async (ctx) => {
    const params = new URLSearchParams(ctx.query);
    const jobId = ctx.params.jobId;

    const link = new URL('/api/sparta/job-experience/experience/job/list', apiServer);

    // const link = `https://www.nowcoder.com/discuss/experience/json?tagId=${tagId}&order=${order}&companyId=${companyId}&phaseId=${phaseId}`;
    const response = await got.post(link.toString(), {
        json: {
            "jobId": jobId,
            "level": 3,
            "order": 3,
            "page": 1,
            "isNewJob": true
        }
    });
    const data = response.data.data;

    const list = data.records.map((x) => {
        // 包含全部内容
        const contentData = x.contentData || x.momentData
        let info = {
            title: contentData.title,
            author: x.userBrief.nickname,
            pubDate: timezone(parseDate(contentData.createTime), +8),
        };
        // 针对非 momentData 情况，额外添加 link 属性
        if (x.momentData) {
            info.description = x.momentData.content.replaceAll('\n', '<br>')
            info.link = new URL('/feed/main/detail/' + x.momentData.uuid, host).href;
        } else {
            info.descriptionUrl = new URL('/api/sparta/detail/content-data/detail/' + x.contentId, apiServer).href;
            info.link = new URL('/discuss/' + x.contentId, host).href;
        }
        return info;
    });
    const out = await Promise.all(
        list.map((info) => {
                if (info.description) {
                    return new Promise((resolve) => {
                        resolve(info);
                    });
                } else {
                    return ctx.cache.tryGet(info.descriptionUrl, async () => {
                        const response = await got.get(info.descriptionUrl);
                        info.description = response.data.data.content;
                        return info;
                    });
                }
            }
        ).filter((o) => o !== null)
    );

    ctx.state.data = {
        title: `牛客面经Job-${ctx.params.jobId}`,
        link: link.href,
        item: out.filter((o) => o !== null),
    };
};
