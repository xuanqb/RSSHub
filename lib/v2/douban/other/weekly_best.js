const got = require('@/utils/got');

module.exports = async (ctx) => {
    const type = ctx.params.type || 'movie_weekly_best';

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

    ctx.state.data = {
        title: infoResponse.data.title,
        link: `https://m.douban.com/subject_collection/${type}`,
        description: infoResponse.data.description,

        item: data.map(({ title, card_subtitle, rank_value, type_name, cover, cover_url, url, rating, year, release_date, good_rating_stats, null_rating_reason, tags, description }) => {
            let tags_text = '',
                type_name_text = '',
                release_text = '',
                good_rating_stats_text = '',
                rank_value_text = '',
                rank_count_text = '';
            const rate = rating ? `${rating.value.toFixed(1)}分` : null_rating_reason;
            if (cover && cover.url) {
                cover_url = cover.url;
            }
            if (good_rating_stats) {
                good_rating_stats_text = `好评率：${good_rating_stats}%  <br>`;
            }
            if (tags && tags.length > 0) {
                const tagName = tags.map((t) => t.name);
                tags_text = tagName ? `标签：${tagName} <br>` : '';
            }
            if (release_text) {
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
            description = `标题：${title} <br>
            ${type_name_text} 
            ${rank_value_text} 
            ${rank_count_text} 
            影片信息：${card_subtitle} <br>
            ${release_text}
            ${good_rating_stats_text}
            评分：${rate} <br>
            ${tags_text}
            <img src="${cover_url}">
            <p>${description}</p >`;

            return {
                title,
                description,
                link: url,
            };
        }),
    };
};
