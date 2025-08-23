const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URLS = {
    momo: "https://momon-ga.com",
    nya: "https://nyahentai.re",
    sm: "https://ddd-smart.net"
};

async function fetchPage(url) {
    try {
        const response = await axios.get(url, { timeout: 5000 });
        return response.data;
    } catch (error) {
        console.error(`URL取得エラー: ${url}, エラーメッセージ: ${error.message}`);
        return null;
    }
}

async function getTotalPages(url, rule) {
    const html = await fetchPage(url);
    if (!html) return 1;
    const $ = cheerio.load(html);

    if (rule === 'momo' || rule === 'nya') {
        const pagesText = $('.wp-pagenavi .pages').text().trim();
        const match = pagesText.match(/(\d+)\s*\/\s*(\d+)/);
        return match ? parseInt(match[2], 10) : 1;
    } else if (rule === 'sm') {
        let totalPages = 1;
        $('.page_menu .cover-ul li a').each((i, elem) => {
            const num = parseInt($(elem).text().trim(), 10);
            if (!isNaN(num) && num > totalPages) {
                totalPages = num;
            }
        });
        return totalPages;
    }
    return 1;
}

async function getSearchResults(q, rule) {
    let url = '';
    if (q) {
        const total = await getTotalPages(`${BASE_URLS[rule]}/?s=${encodeURIComponent(q)}`, rule);
        const page = Math.floor(Math.random() * total) + 1;
        url = `${BASE_URLS[rule]}/page/${page}/?s=${encodeURIComponent(q)}`;
    } else {
        const urls = {
            momo: [`${BASE_URLS.momo}`, `${BASE_URLS.momo}/trend`],
            nya: [`${BASE_URLS.nya}`, `${BASE_URLS.nya}/rising`],
            sm: [`${BASE_URLS.sm}`]
        };
        url = urls[rule][Math.floor(Math.random() * urls[rule].length)];
    }

    const html = await fetchPage(url);
    if (!html) return [];
    const $ = cheerio.load(html);
    
    const results = [];
    
    if (rule === 'momo') {
        $('.hentai-list li a').each((i, elem) => {
            const img = $(elem).find('img');
            const title = $(img).attr('alt') || 'タイトル不明';
            const image = img.attr('src');
            if (image && title) {
                results.push({ image, title, rule: 'mo' });
            }
        });
    } else if (rule === 'nya') {
        $('a').each((i, elem) => {
            const img = $(elem).find('.post-list-image img');
            const title = $(elem).find('span').text().trim() || 'タイトル不明';
            const image = img.attr('src');
            if (image && title) {
                results.push({ image, title, rule: 're' });
            }
        });
    } else if (rule === 'sm') {
        $('.comics, li').each((i, elem) => {
            const title = $(elem).find('p.title').text().trim() || $(elem).find('h2, h3').text().trim();
            const img = $(elem).find('img').first();
            const image = img.attr('src');
            if (image && title) {
                results.push({ title, image, rule: 'sm' });
            }
        });
    }

    return results;
}

async function search(q) {
    try {
        const [momoResults, nyaResults, smResults] = await Promise.all([
            getSearchResults(q, 'momo'),
            getSearchResults(q, 'nya'),
            getSearchResults(q, 'sm')
        ]);

        const results = [...momoResults, ...nyaResults, ...smResults];

        if (results.length === 0) {
            throw new Error("見つからなかった");
        }
        return results;
    } catch (error) {
        console.error('検索エラー:', error.message);
        return null;
    }
}

async function getDetails(url) {
    // URLからサイトのルールとIDを判定
    let rule, id;
    if (url.includes(BASE_URLS.momo)) {
        rule = 'mo';
        id = url.match(/fanzine\/(\d+)/)[1];
    } else if (url.includes(BASE_URLS.nya)) {
        rule = 're';
        id = url.match(/fanzine\/(\d+)/)[1];
    } else if (url.includes(BASE_URLS.sm)) {
        rule = 'sm';
        const match = url.match(/\/(\d{8})\/(\d{3})\//);
        id = `${match[1]}&${match[2]}`;
    } else {
        return 'error';
    }

    const html = await fetchPage(url);
    if (!html) return 'error';
    const $ = cheerio.load(html);

    let details = {};

    if (rule === 'mo' || rule === 're') {
        details.title = $('h1').text().trim() || 'タイトル不明';
        details.pages = $('#post-number').text().trim() || 'ページ数不明';
        
        const links = $('a[rel="tag"]');
        details.authors = links.filter((i, a) => /\/artist\//.test($(a).attr('href'))).map((i, a) => $(a).text().trim()).get().join(', ') || '不明';
        details.circle = links.filter((i, a) => /\/circle\//.test($(a).attr('href'))).map((i, a) => $(a).text().trim()).get().join(', ') || '不明';
        
        details.imageUrls = [];
        $('#post-hentai img, #post-comic img').each((i, img) => {
            details.imageUrls.push($(img).attr('src'));
        });
    } else if (rule === 'sm') {
        details.title = $('h1').text().trim() || 'タイトル不明';
        const pageText = $('.bookview-wrap').contents().filter(function() { return this.type === 'text'; }).text().trim();
        const match = pageText.match(/1\s*\/\s*(\d+)/);
        details.pages = match ? parseInt(match[1], 10) : 'ページ数不明';
        details.authors = '不明';
        details.circle = '不明';
        
        const [part1, part2] = id.split('&');
        details.imageUrls = [`https://cdn.ddd-smart.net/${part1}/${part2}/000.jpg`];
    }
    
    return details;
}

module.exports = {
    search,
    getDetails
};
