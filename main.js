const puppeteer = require('puppeteer');
const utils = require('./lib/utils');

const cfg = {
    isDev: true
}

const BASE_URL = 'https://www.crazygames.com/';
const DEFAULT = ['home'];
const TOPS = ['best', 'new'];
const CATEGROY = ['io', 'action', 'adventure', 'arcade', 'driving', 'girls', 'puzzle', 'shooting', 'skill', 'sports', 'clicker'];
const TAGS = []; // 标签分类过多，暂不考虑

async function getPage() {
    const browser = await (puppeteer.launch({
        timeout: 50000,
        ignoreHTTPSErrors: true,
        devtools: cfg.isDev,
        headless: !cfg.isDev,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }));

    const page = await browser.newPage();
    return page;
}

// 是否最后一页
async function isLastPage(page) {
    // const pn = page.$('p.pagination')
    return await page.$eval('p.pagination', (pn) => {
        if (!pn || pn.childElementCount <= 0) {
            return true;
        }
        if (pn.lastElementChild.tagName == 'STRONG') {
            return true;
        }
        return false;
    }).catch(error => {
        console.error('====== isLastPage error =======');
        return true
    })
}

/** 获取url地址 */
async function getUrl(type, count) {
    let reqPath = '';
    if (type == 'home') {
        reqPath = count > 1 ? count + '' : '';
    } else if (type == 'best' || type == 'new') {
        reqPath = count > 1 ? `${type}/${count}` : `${type}/`;
    } else {
        reqPath = count > 1 ? `c/${type}/${count}` : `c/${type}/`;
    }

    var url = BASE_URL + reqPath;
    return url;
}

/** 获取列表 */
async function getList(page, type) {
    const ul = await page.$('#games-main-column .games-ul');
    const all = await ul.$$eval('.tile', tiles => {
        if (!tiles) {
            console.error('no tiles');
            return [];
        }
        var arr = [];
        for (let i = 0; i < tiles.length; i++) {
            const tile = tiles[i];
            let data = {};
            data.gameSlug = tile.getAttribute('data-game-slug');
            data.videoSrc = 'https://videos.crazygames.com/' + tile.getAttribute('data-video-src');
            data.imgSrc = tile.getAttribute('data-image-src');
            const aTag = tile.firstElementChild;
            data.url = aTag.getAttribute('href');
            const titleTag = tile.querySelector('.tileTitleOverflow');
            data.name = titleTag ? titleTag.innerHTML : '';
            const scoreTag = titleTag.nextElementSibling;
            data.score = scoreTag.innerHTML;
            arr.push(data)
        }
        return arr;
    }).catch(error => {
        console.error('=== getList error: ' + error.stack);
        return [];
    });
    all.forEach(data => { data.type = type });
    return all;
}
/** 通用获取方法 */
async function getCommon(page, type, count, arr) {
    const url = await getUrl(type, count);
    console.log(`==> type: ${type}, page: ${count}, url = ${url}`);
    page.goto(url, { timeout: 0 });
    await page.waitForResponse(url);
    await page.waitFor(4000)
    const newArr = await getList(page, type);
    arr = arr.concat(newArr);
    // console.log('getList over');
    const isLast = await isLastPage(page);
    if (isLast) {
        console.log(`==> isLast type: ${type}<==`);
        return Promise.resolve(arr);
    } else {
        return await getCommon(page, type, count + 1, arr)
    }
}
// 获取home
async function getDefault(page) {
    return await getCommon(page, 'home', 1, [])
}

async function getAllCollect(page) {
    let arr = [];
    for (let i = 0; i < CATEGROY.length; i++) {
        const name = CATEGROY[i];
        const newArr = await getCommon(page, name, 1, [])
        arr = arr.concat(newArr);
    }
    console.log('getAllCollect over');
    return arr;
}

async function getBestAndNew(page) {
    var bestArr = await getCommon(page, 'best', 1, []);
    var newArr = await getCommon(page, 'new', 1, []);
    return bestArr.concat(newArr);
}

async function getDetails(page, data) {

}

async function main() {
    try {
        const page = await getPage();
        page.setMaxListeners(50);
        const home = await getDefault(page);
        console.log('home len = ' + home.length);
        const bestAndNew = await getBestAndNew(page);
        console.log('bestAndNew len = ' + bestAndNew.length);
        const collect = await getAllCollect(page)
        console.log('collect len = ' + collect.length);
        var arr = home.concat(bestAndNew, collect);

        await utils.exportJsonToCsv('.temp/test.csv', arr);
        await utils.utf8ToGbk('.temp/test.csv', 'out/all.csv');
        page.close();
        process.exit();
    } catch (error) {
        console.error('======> error ');
        console.error(error);
        process.exit();
    }
}

main();
