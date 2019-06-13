const moment = require('moment');
const path = require('path');
const glob = require('glob');
const csvtojson = require('csvtojson');
const iconv = require('iconv-lite');
const fastcsv = require('fast-csv');
const fs = require('fs');
const _ = require('lodash');

/** 获取时间戳 */
function getFileTime(name) {
    return moment(name, 'YYYY.MM.DD').valueOf();
}
exports.getFileTime = getFileTime;

/** 获取某一目录下文件名称数组 */
exports.getFilesArr = async function (root) {
    return new Promise((resolve) => {
        const filePath = path.join(root, '*.csv');
        glob(filePath, (err, files) => {
            files.sort((a, b) => {
                const timeA = getFileTime(a);
                const timeB = getFileTime(b);
                return timeA - timeB;
            });
            resolve(files);
        });
    });
};

/** 加载csv数据为json */
exports.importCsvToJson = async function (fileName, encoding = 'utf8') {
    return new Promise((resolve) => {
        if (encoding == 'gbk') {
            fs.readFile(fileName, (err, data) => {
                if (err) throw err;
                data = iconv.decode(data, 'gbk');
                csvtojson().fromString(data)
                    .then(jsonObj => resolve(jsonObj)
                    );
            });
        } else {
            csvtojson()
                .fromFile(fileName)
                .then((jsonObj) => resolve(jsonObj));
        }
    });
};

/** 导出json数据到csv */
exports.exportJsonToCsv = async function (filePath, jsonObj) {
    return new Promise((resolve) => {
        var ws = fs.createWriteStream(filePath);
        ws.on('close', resolve);
        fastcsv
            .write(jsonObj, { headers: true })
            .pipe(ws);
    });
};

/** utf8转码GBK */
exports.utf8ToGbk = function (srcPath, destPath, cb) {
    return new Promise((resolve) => {
        if (destPath instanceof Function) {
            destPath = srcPath;
            cb = destPath;
        }
        fs.readFile(srcPath, function (err, data) {
            data = iconv.encode(data, 'gbk');
            fs.writeFile(destPath, data, function (error) {
                if (error) throw error;
                console.log('over');
                cb && cb();
                resolve();
            });
        });
    });
};

/** 汉字数字单位转换为具体数字 */
exports.trans = function trans(countStr) {
    if (!countStr) countStr = '';
    const list = {
        '十': 10,
        '百': 100,
        '千': 1000,
        '万': 10000,
        '亿': 100000000
    };
    const arr = (countStr).match(/万|亿/g);
    if (!arr) return countStr;
    const key = arr[0]; // 得到‘亿’或者‘万’
    countStr = countStr.replace(key, '');
    let num = countStr.replace(',', '');
    num = _.trim(num);
    num = Number(num);
    num = num * list[key];
    countStr = num.toLocaleString();
    return countStr;
};