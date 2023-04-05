const got = require('@/utils/got');


module.exports = async (ctx) => {
    const type = ctx.params.type || 'movie_weekly_best';
    const linkStyle = ctx.params.linkStyle || 'douban';

    const link = 'https://m.douban.com/movie';
    const apiUrl = `https://m.douban.com/rexxar/api/v2/subject_collection/${type}`;

    const itemResponse = await got({
        method: 'get',
        url: `${apiUrl}/items?start=0&count=250`,
        headers: {
            Referer: link,
        },
    });
    const infoResponse = await got({
        method: 'get',
        url: apiUrl,
        headers: {
            Referer: link,
        },
    });

    const data = itemResponse.data.subject_collection_items;
    let title = infoResponse.data.title;
    if (!title && infoResponse.data.name) {
        title = infoResponse.data.name;
    }

    ctx.state.data = {
        title,
        link: `https://m.douban.com/subject_collection/${type}`,
        description: infoResponse.data.description,

        item: data.map(({
                            title,
                            card_subtitle,
                            rank_value,
                            type_name,
                            pic,
                            cover,
                            cover_url,
                            url,
                            uri,
                            rating,
                            year,
                            release_date,
                            good_rating_stats,
                            null_rating_reason,
                            tags,
                            description,
                            comment,
                            id
                        }) => {
            let tags_text = '',
                type_name_text = '',
                release_text = '',
                good_rating_stats_text = '',
                rank_value_text = '',
                rank_count_text = '';
            // 忽略无评分的词条
            if (!rating || !(typeof rating.value === 'number' && !isNaN(rating.value) && rating.value !== 0)) {
                return undefined;
            }
            const rate = `${rating.value.toFixed(1)}分`;
            // 描述
            if (!description && comment) {
                description = comment;
            }
            // 条目对应个url
            if (!url) {
                url = `https://movie.douban.com/subject/${id}/`;
            }
            // 选择封面
            if (cover && cover.url) {
                cover_url = cover.url;
            } else if (pic && pic.normal) {
                cover_url = pic.normal;
            }
            // 好评率
            if (good_rating_stats) {
                good_rating_stats_text = `好评率：${good_rating_stats}%  <br>`;
            }
            if (tags && tags.length > 0) {
                const tagName = tags.map((t) => t.name);
                tags_text = tagName ? `标签：${tagName} <br>` : '';
            }
            if (release_date) {
                release_text = `上映日期：${year}.${release_date} <br>`;
            }
            if (type_name) {
                type_name_text = `类型：${type_name} <br>`;
            }
            if (rank_value) {
                rank_value_text = `排名：${rank_value} <br>`;
            }
            if (rating && rating.count) {
                rank_count_text = `评价数：${rating.count}<br>`;
            }
            description = `标题：<a href="${url}">${title}</a> <br>
            ${type_name_text}
            评分：${rate} <br>
            ${rank_value_text}
            ${rank_count_text}
            影片信息：${card_subtitle} <br>
            ${release_text}
            ${good_rating_stats_text}
            ${tags_text}
            <img src="${cover_url}">
            <p>${description}</p >`;

            if (linkStyle !== 'douban') {
                uri = url;
            }

            return {
                title,
                description,
                link: uri,
            };
        }).filter((item) => item !== undefined),
    };
};
