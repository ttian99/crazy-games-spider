const puppeteer = require('puppeteer');
const csv = require('fast-csv');
const fs = require('fs-extra');
const moment = require('moment');
const utils = require('./utils');
const path = require('path');
const cfg = require('../config.json');

async function getSpider(resolve) {
    const browser = await (puppeteer.launch({
        timeout: 50000,
        ignoreHTTPSErrors: true,
        devtools: cfg.isDev,
        headless: !cfg.isDev,
	    args: ['--no-sandbox', '--disable-setuid-sandbox']
    }));

    const page = await browser.newPage();

    // 创建可写流
    const FILE = path.join(__dirname, '../data-raw', `facebook.${moment().format('YYYY.MM.DD')}.csv`);
    const NEW_FILE = path.join(__dirname, '../data-format', `facebook.${moment().format('YYYY.MM.DD')}.csv`);
    const writeStream = fs.createWriteStream(FILE);
    const csvStream = csv.createWriteStream({ headers: true });
    writeStream.on('finish', async function () {
        console.log('spider over');
        await utils.utf8ToGbk(FILE, NEW_FILE);
        console.log('DONE!');
        resolve && resolve();
        browser.close();
    });
    csvStream.pipe(writeStream);

    let count = 0;
    let len = 10000;
    const FACEBOOK_URL = 'https://www.facebook.com/';
    const INSTANT_GAME_URL = 'https://www.facebook.com/instantgames/';
    const email = cfg.facebookAccount.user;
    const password = cfg.facebookAccount.pass;

    // 下滑刷新
    async function pageEnd() {
        console.log('==== do pageEnd');
        await page.waitFor(1000);
        await page.keyboard.press('End');
    }

    // 获取总长度
    function getLen() {
        return len;
    }
    // 监听函数
    async function logResponse(data) {
        const url = data.url();
        const regDpr = new RegExp('graphqlbatch');
        if (regDpr.test(url)) {
            console.log('===========> graphqlbatch');
            return;
        }
        const reg = new RegExp('graphql');
        if (reg.test(url)) {
            console.log(`==== get matched Url : ${url}`);
            let json;
            try {
                json = await data.json();
            } catch (error) {
                throw error;
            }

            // 获取数据总量
            if (json.data.hasOwnProperty('instant_games_recommendation_ids')) {
                len = json.data.instant_games_recommendation_ids.length;
                console.log(`==== 游戏总数量: ${len}`);
            }

            if (json.data.hasOwnProperty('instant_games_recommendation_details')) {
                console.log('==== for start ');
                const arr = json.data.instant_games_recommendation_details;
                for (let i = 0; i < arr.length; i++) {
                    const item = arr[i];
                    const app_center_categories = item.app_center_categories.splice(1).join();
                    let player_count = item.instant_game_info.player_count;
                    const newData = {
                        'id': item.id,
                        'game_name': item.instant_game_info.game_name,
                        'developer_name': item.instant_game_info.developer_name,
                        'player_count': utils.trans(player_count),
                        'app_center_categories': app_center_categories,
                        'icon_uri': item.instant_game_info.icon_uri,
                        'is_favorite': item.instant_game_info.is_favorite
                    };
                    // 写入数据到表格
                    await csvStream.write(newData);
                }
                console.log('==== for over ');

                // 增加计数
                const arrLen = arr.length;
                console.log(`==== count = ${count}, arrLen = ${arrLen}`);
                if (count <= 0) { // 第一次获取到
                    console.log('==== 第一次获取到');
                    count += arrLen;
                    await pageEnd();
                    return;
                }
                count += arrLen;
                const newLen = getLen();
                // 判断所有数据是否完成
                if (count >= newLen) {
                    console.log('=== 所有数据完成!');
                    csvStream.end();
                } else {
                    await pageEnd();
                }
            }
        }
    }
    console.log(`==== start goto ${FACEBOOK_URL}`);
    page.goto(FACEBOOK_URL, { timeout: 500000 }).catch(err => console.log(`==== error goto ${FACEBOOK_URL} : ${err}`));
    console.log(`==== over goto ${FACEBOOK_URL}`);

    const context = browser.defaultBrowserContext();
    await context.overridePermissions(INSTANT_GAME_URL, ['notifications']);

    // 输入账号密码
    console.log('==== start type password');
    await page.waitFor(10000);
    await page.type('#email', email, { delay: 100 });
    await page.waitFor(2000);
    await page.type('#pass', password, { delay: 100 });
    await page.waitFor(2000);
    await page.keyboard.press('Enter');
    // 跳转小游戏页面
    await page.waitFor(4000);

    page.on('response', logResponse);
    console.log(`==== start goto ${INSTANT_GAME_URL}`);
    await page.goto(INSTANT_GAME_URL, { timeout: 500000 }).catch(err => console.log(`==== error goto ${INSTANT_GAME_URL} : ${err}`));
    console.log(`==== over goto ${INSTANT_GAME_URL}`);
    await page.waitFor(2000);
    // pageEnd();

    console.log('==== over scroll');
}

const spider = async function spider() {
    return new Promise(getSpider);
};


module.exports = spider;
