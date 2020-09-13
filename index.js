const sequelize = require('sequelize');
const db = new sequelize("mysql://root:test1234&@151.80.140.49:3306/freebitcoin");
const { Op } = require('sequelize');
const https = require('https');
const SocksProxyAgent = require('socks-proxy-agent');
const puppeteer = require('puppeteer-extra');
const imaps = require('imap-simple');
const _ = require('lodash');
const path = require('path');
const fs = require('fs');
const captchaSolver = require(path.resolve( __dirname, "./captchaSolver.js" ))
const simpleParser = require('mailparser').simpleParser;
const utils = require(path.resolve( __dirname, "./utils.js" ));
var cron = require('node-cron');

const headless = true;
const datadir = path.resolve( __dirname, "./datadir" )

var winnings = 0;
var nb_roll = 0;
var nb_acc = 5;
var nb_proxies = 1000;
var nb_iter = 0;

db.options.logging = false;

var Proxies = db.define('proxies', {
    ip: { type: sequelize.STRING },
    port: { type: sequelize.INTEGER },
    protocol: { type: sequelize.STRING },
    up: { type: sequelize.BOOLEAN },
    last_up: { type: sequelize.DATE },
    delay_ms: { type: sequelize.DECIMAL }
}, {
    underscored: true,
    paranoid: false,
    freezeTableName: true,
    tableName: 'proxies'
});

var Accounts = db.define('accounts', {
    email: { type: sequelize.STRING },
    password: { type: sequelize.STRING },
    balance: { type: sequelize.STRING },
    last_roll: { type: sequelize.DATE },
    last_cashout: { type: sequelize.DATE },
    type: { type: sequelize.BOOLEAN},
    btc_addr: { type: sequelize.STRING },
    refferer: { type: sequelize.INTEGER },
    proxy: { type: sequelize.STRING },
    message1: { type: sequelize.STRING },
    message2: { type: sequelize.STRING }
}, {
    underscored: true,
    paranoid: true,
    freezeTableName: true,
    tableName: 'accounts'
});

async function init() {
    utils.printTitle(0);
    utils.log(1, 'init()', 'sync proxies table');
    await Proxies.sync({force: false});
    utils.log(1, 'init()', 'sync accounts table');
    await Accounts.sync({force: false});
}

async function testPage(proxyUrl) {
    var tmp = proxyUrl.split("://");
    var tmp2 = tmp[1].split(":")
    return new Promise(function(resolve, reject) {
        try {
            const info = {
                host: tmp2[0],
                port: tmp2[1],
            };
            const agent = new SocksProxyAgent(info);
            var request = https.get('https://api.ipify.org', { agent }, (res) => {
                resolve(1);
            });
            request.on('error', function(err) {
                resolve(0);
            });
            request.setTimeout( 30000, function( ) {
                resolve(0);
            });
        } catch (e) {
            resolve(0);
        }
    });
}

async function getProxies() {
    utils.log(1, 'getProxies()', 'truncate proxies table');
    await Proxies.destroy({where: 1, truncate: true});
    var directory = path.normalize(__dirname+'/proxies');
    await insertProxies('socks5', path.normalize( directory+'/proxyscrape_10000_socks5_proxies.txt'));
}

async function getFreeProxies() {
    utils.log(1, 'getFreeProxies()', 'truncate proxies table');
    await Proxies.destroy({where: 1, truncate: true});
    return new Promise(async (resolve, reject) => {
        try {
            var directory = path.normalize(__dirname+'/proxies')
            fs.readdir(directory, (err, files) => {
                if (err) throw err;
                for (const file of files) {
                    if (file != "proxyscrape_10000_socks5_proxies.txt") {
                        fs.unlink(path.join(directory, file), err => {
                            if (err) throw err;
                        });
                    }
                }
            });
            const browser = await puppeteer.launch({
                headless:headless,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox'
                ],
            });            
            const page = await browser.newPage();
            await page._client.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: directory
            });
            utils.log(1, 'getFreeProxies()', 'https://www.proxyscan.io/');
            await page.goto('https://www.proxyscan.io/');
            await page.click('#layout-wrapper > div > div.page-content > div > div:nth-child(1) > div > div > ul > li:nth-child(3) > p > a');
            await page.click('#layout-wrapper > div > div.page-content > div > div:nth-child(1) > div > div > ul > li:nth-child(4) > p > a');
            await utils.sleep(utils.rdn(2000, 5000));
            await insertProxies('socks4', path.normalize(directory+'/SOCKS4-proxies.txt'));
            await insertProxies('socks5', path.normalize( directory+'/SOCKS5-proxies.txt'));
            utils.log(1, 'getFreeProxies()', 'https://proxyscrape.com/free-proxy-list');
            await page.goto('https://proxyscrape.com/free-proxy-list');
            await utils.sleep(2000);
            await page.click('#downloadsocks4');
            await page.click('#downloadsocks5');
            await utils.sleep(5000);
            await page.close();
            await browser.close();
            await insertProxies('socks4', path.normalize(directory+'/socks4_proxies.txt'));
            await insertProxies('socks5', path.normalize( directory+'/socks5_proxies.txt'));
            var str = ''
            var options = {
                host: 'www.proxyrack.com',
                path: '/proxyfinder/proxies.json?page=1&perPage=100000&offset=0'
            };
            utils.log(1, 'getFreeProxies()', 'https://www.proxyrack.com/proxyfinder/proxies.json?page=1&perPage=1000000&offset=0');
            var request = https.get('https://www.proxyrack.com/proxyfinder/proxies.json?page=1&perPage=1000000&offset=0', (res) => {
                res.on('data', function (chunk) {
                    str += chunk;
                });
                res.on('end', async function () {
                    var data = JSON.parse(str);
                    for (var row of data.records) {
                        if (row.protocol == 'socks4' || row.protocol == 'socks5') {
                            var proxies = await Proxies.findAll({where: {ip: row.ip}});
                            if (proxies.length == 0) {
                                await Proxies.create({ip: row.ip, port: row.port, protocol: row.protocol});
                            }
                        }
                    }
                    resolve(0);
                });
                res.on('error', function(err) {
                    utils.log(3, 'getFreeProxies()', err);
                    resolve(0);
                });
            });
            request.setTimeout( 60000, function( ) {
                resolve(0);
            });
            resolve(0);
        } catch (e) {
            utils.log(3, 'getFreeProxies()', e);
            resolve(0);
        }
    })
}

async function insertProxies(type, filename) {
    return new Promise(async (resolve) => {
        try {
            utils.log(1, 'insertProxies()', filename)
                fs.readFile(filename, 'utf8', async (err, data) => {
                    if (err) throw err;
                    var tab1 = data.split('\n');
                    for (elem of tab1) {
                        var tab2 = elem.split(':');
                        if (elem) {
                            var proxies = await Proxies.findAll({where: {ip: tab2[0]}});
                            if (proxies.length == 0) {
                                await Proxies.create({ip: tab2[0], port: tab2[1], protocol: type});
                            }
                        }
                    }
                    resolve(0);
                });
        } catch (e) {
            utils.log(3, 'insertProxies()', e);
            resolve(0);
        }
    })
}

async function assignProxies() {
    return new Promise(async (resolve) => {
        var accounts = await Accounts.findAll({where: {}, order: [['type', 'ASC']]});
        var accLength = accounts.length;
        var proxies = await Proxies.findAll({where: {[Op.and]: [{ up: true }, { delay_ms: {[Op.lte]: 10000}}]}, order: [['delay_ms', 'ASC']]});
        utils.log(1, "processAvailableAccounts()", proxies.length+" available proxies");
        for (var i = 0; i < accLength; i++) {
            var proxy = proxies[i].protocol+"//:"+proxies[i].ip+":"+proxies[i].port
            await Accounts.update({proxy: proxy}, {where: {id: accounts[0].id}});
        }
        return resolve(1);
    })
}

async function checkProxy(proxyUrl) {
    return new Promise(async resolve => {
        var tmp = proxyUrl.split("://");
        var tmp2 = tmp[1].split(":")
        var start = new Date().getTime();
        var testRes = await testPage(proxyUrl);
        var end = new Date().getTime();
        var time = end - start;
        if (testRes == 0) {
            await Proxies.update({ up: false, delay_ms: null, last_up: null }, {
                where: {[Op.and]: [{ ip: tmp2[0] }, { port: tmp2[1] }]}}
            );
            utils.log(1, 'checkProxy()', proxyUrl+'\x1b[38;5;160m KO\x1b[0m');
            resolve(0);
        } else {
            await Proxies.update({ up: true, last_up: new Date(), delay_ms: time }, {
                where: {[Op.and]: [{ ip: tmp2[0] }, { port: tmp2[1] }]}}
            );
            utils.log(1, 'checkProxy()', proxyUrl+'\x1b[38;5;34m OK\x1b[0m');
            resolve(1);
        }
    });
}

async function checkAllProxies() {
    return new Promise(async resolve => {
        var proxies = await Proxies.findAll({});
        var promiseTab = [];
        var delay = 0;
        var i = 0;
        while(proxies.length) {
            chunk = proxies.splice(0, nb_proxies);
            for (elem of chunk) {
                promiseTab.push(checkProxy(elem.protocol+"://"+elem.ip+":"+elem.port));
            }
            await Promise.all(promiseTab);
        }
        resolve(1);
    })
}

function getVerificationLink(email, password, situation) {
    return new Promise(async (resolve, reject) => {
        try {
            var keywords = '';
            var host = 'imap.gmail.com'
            var index = 0;
            if (situation == 1) {
                keywords = "verify your email by clicking the link below";
            } else {
                keywords = "you need to authorize this request"
            }
            if (email.includes('laposte.net')) {
              host = 'imap.laposte.net';
              index = 1;
            }
            if (email.includes('gmx.com')) {
              host = 'imap.gmx.com';
              index = 1;
            }
            if (email.includes('yandex.com')) {
              host = 'imap.yandex.com';
              index = 1;
            }
            if (email.includes('outlook.')) {
              host = 'outlook.office365.com';
              index = 1;
            }
            utils.log(1, 'getVerificationLink()', email+' '+host);
            var config = {
                imap: {
                    user: email,
                    password: password,
                    host: host,
                    port: 993,
                    tls: true,
                    authTimeout: 3000,
                    tlsOptions: {
                        rejectUnauthorized: false
     		        }
                }
            };
            imaps.connect(config).then(function (connection) {
                connection.openBox('INBOX').then(() => {
                    var searchCriteria = ['UNSEEN'];
                    var fetchOptions = {
                        bodies: ['HEADER', 'TEXT'],
                    };
                    connection.search(searchCriteria, fetchOptions).then( async function (messages) {
                        connection.on("error", function(e) {
                            utils.log(3, "getVerificationLink()", email+" An error occured."+e);
                            return reject(e);
                        });
                        if (messages.length == 0) {
                            utils.log(2, 'getVerificationLink()', email+' no new message received');
                            resolve(0);
                        } else {       
                            for(var i = messages.length - 1; i >= 0; i--) {
                                var body = messages[i].parts[index].body;
                                let parsed = await simpleParser(body);
                                // console.log(parsed.text);
                                if (parsed.text.includes("https://freebitco.in/?op=email_verify&i") && parsed.text.includes(keywords)) {
                                    var tab = parsed.text.match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)/gm)
                                    for (elem of tab) {
                                        if (elem.indexOf("https://freebitco.in/?op=email_verify") !== -1) {
                                            utils.log(1, 'getVerificationLink()', email+" "+elem);
                                            return resolve(elem);
                                        }
                                    }
                                }
                                connection.addFlags(messages[i].attributes.uid, "\Deleted", (err) => {
                                    if (err) console.log(err);
                                });
                            }
                            utils.log(2, 'getVerificationLink()', email+' no message received from freebitco.in');
                            resolve(0);
                        }
                    }).catch(e => {
                        utils.log(3, 'getVerificationLink()', email+" "+e);
                        resolve(0);
                    });
                }).catch(e => {
                    utils.log(3, 'getVerificationLink()', email+" "+e);
                    resolve(0);
                });
            }).catch(e => {
                utils.log(3, 'getVerificationLink()', email+" "+e);
                resolve(0);
            });
        }
        catch(e) {
            utils.log(3, 'getVerificationLink()', email+" "+e);
            resolve(0);
        }
    });
}

async function ipVerification(link, browser, email) {
    return new Promise(async (resolve, reject) => {
        try {
            const page = await browser.newPage();
            await page.goto(link);
            await page.waitForSelector('body > center > div > input[type=button]:nth-child(2)', {timeout: 30000});
            await page.click('body > center > div > input[type=button]:nth-child(2)');
            await page.bringToFront();
            await utils.sleep(utils.rdn(5000, 10000));
            await page.goto('about:blank');
            await page.close;
            resolve(0);
        } catch (e) {
            utils.log(3, 'ipVerification()', email+' '+e);
            reject(e);
        }
    });
}

async function closePushModal(page, email) {
    return new Promise(async resolve => {
        try {
            await page.waitForSelector("#push_notification_modal > div.push_notification_big > div:nth-child(2) > div > div.pushpad_deny_button", {timeout: 30000});
            var element = await page.$("#push_notification_modal > div.push_notification_big > div:nth-child(2) > div > div.pushpad_deny_button");
            utils.log(1, 'closePushModal()', email+" click notification modal button big ");
            await element.click();
        } catch (e) {
            // utils.log(2, 'closePushModal()', email+" "+e);
        } finally {
            resolve(page);
        }
    })
}

async function closeSetCookie(page, email) {
    return new Promise(async resolve => {
        try {
            await page.waitForSelector("body > div.cc_banner-wrapper > div > a.cc_btn.cc_btn_accept_all", {timeout: 3000});
            var element = await page.$("body > div.cc_banner-wrapper > div > a.cc_btn.cc_btn_accept_all");
            utils.log(1, 'closeSetCookie()', email+" click cookies banner button");
            await element.click();
        } catch (e) {
            // utils.log(2, 'closeSetCookie()', email+" "+e);
        } finally {
            resolve(page);
        }
    })
}

async function logIn(page, email, password) {
    return new Promise(async (resolve, reject) => {
        try {
            await utils.sleep(utils.rdn(2000, 5000));
            utils.log(1, 'logIn()', email+" try to logIn");
            await page.waitForSelector("body > div.large-12.fixed > div > nav > section > ul > li.login_menu_button > a", {timeout: 30000});
            var element = await page.$("body > div.large-12.fixed > div > nav > section > ul > li.login_menu_button > a");
            await element.click();
            await utils.sleep(utils.rdn(1000, 3000));
            // utils.log(1, 'logIn()', email+" fill email");
            await page.waitForSelector('#login_form_btc_address', {timeout: 30000});
            await page.evaluate((text) => { (document.getElementById('login_form_btc_address')).value = text; }, email);
            await utils.sleep(utils.rdn(1000, 3000));
            // utils.log(1, 'logIn()', email+" fill password '"+password+"'");
            await page.waitForSelector('#login_form_password', {timeout: 30000});
            await page.evaluate((text) => { (document.getElementById('login_form_password')).value = text; }, password);
            // utils.log(1, 'logIn()', email+" click login button");
            await utils.sleep(utils.rdn(1000, 3000));
            await page.waitForSelector('#login_button', {timeout: 30000});
            element = await page.$("#login_button");
            await element.click();
            resolve(page);
        } catch(e) {
            utils.log(3, 'logIn()', email+" "+e);
            await page.close();
            reject(e);
        }
    })
}

async function rollAccount(page, email, password) {
    return new Promise(async (resolve, reject) => {
        try {
            await page.reload({ waitUntil: ["networkidle0", "domcontentloaded"] });
            utils.log(1, "rollAccount()", email+" trying to resolve captcha");
            await utils.sleep(utils.rdn(2000, 5000));
            page = await closePushModal(page, email);
            await utils.sleep(utils.rdn(2000, 5000));
            await page.screenshot({path: path.resolve( __dirname, "./test.png" )});
            isCaptcha = await captchaSolver.solve(page).catch((e) => {throw e});
            if (!isCaptcha) {
                utils.log(1, "processAvailableAccounts()", email+" recaptcha \x1b[38;5;160mKO\x1b[0m");
                await page.reload({ waitUntil: ["networkidle0", "domcontentloaded"] });
                utils.log(1, 'rollAccount()', email+" click play without captcha button");
                await page.waitForSelector('#play_without_captchas_button', {timeout: 30000});
                element = await page.$("#play_without_captchas_button");
                await element.click();
                await utils.sleep(utils.rdn(2000, 5000));
            } else {
                utils.log(1, "processAvailableAccounts()", email+" recaptcha \x1b[38;5;34mOK\x1b[0m")
            }
            await utils.sleep(utils.rdn(2000, 5000));
            utils.log(1, 'rollAccount()', email+" click roll button");
            await page.waitForSelector('#free_play_form_button', {timeout: 30000});
            element = await page.$("#free_play_form_button");
            await element.click();
            await utils.sleep(utils.rdn(2000, 5000));
            // await page.screenshot({path: path.resolve( __dirname, "./test.png" )});
            return resolve(page);
        } catch (e) {
            utils.log(3, 'rollAccount()', email+" "+e);
            if (page) {
                await page.close();
            }
            reject(e);
        }
    })
}

async function getBalance(page, email) {
    return new Promise(async (resolve, reject) => {
        try {
            await page.waitForSelector('#balance', {timeout: 30000});
            var element = await page.$("#balance");
            text = await page.evaluate(element => element.textContent, element);
            var balance = text.split('&nbsp;')[0];
            utils.log(1, 'getBalance()', email+" balance = "+balance);
            resolve(balance);
        } catch (e) {
            utils.log(3, 'getBalance()', email+" "+e);
            reject("can't get balance");
        }
    });
}

async function getWinnings(page, email) {
    return new Promise(async resolve => {
        try {
            await page.waitForSelector('#myModal22 > a', {timeout: 30000});
            var element = await page.$("#myModal22 > a");
            await element.click();
            await page.waitForSelector('#winnings', {timeout: 30000});
            element = await page.$("#winnings");
            text = await page.evaluate(element => element.textContent, element);
            var acc_winnings = Number(text);
            winnings += acc_winnings;
            nb_roll++;
            utils.log(1, "getWinnings()", email+" roll winnings "+acc_winnings.toFixed(8))
            resolve(0);
        } catch (e) {
            utils.log(1, 'getWinnings()', email+" can't get winnings");
            resolve(0);
        }
    });
}

function processAccount(email, password, proxy, id) {
    return new Promise(async resolve => {

        puppeteer.use(
            require('puppeteer-extra-plugin-stealth/evasions/chrome.app')(),
        );
        puppeteer.use(
            require('puppeteer-extra-plugin-stealth/evasions/chrome.csi')(),
        );
        puppeteer.use(
            require('puppeteer-extra-plugin-stealth/evasions/chrome.loadTimes')(),
        );
        puppeteer.use(
            require('puppeteer-extra-plugin-stealth/evasions/chrome.runtime')(),
        );

        puppeteer.use(
            require('puppeteer-extra-plugin-stealth/evasions/media.codecs')(),
        );
        puppeteer.use(
            require('puppeteer-extra-plugin-stealth/evasions/navigator.languages')(),
        );

        puppeteer.use(
            require('puppeteer-extra-plugin-stealth/evasions/navigator.webdriver')(),
        );
        puppeteer.use(
            require('puppeteer-extra-plugin-stealth/evasions/sourceurl')(),
        );
        puppeteer.use(
            require('puppeteer-extra-plugin-stealth/evasions/user-agent-override')(),
        );

        // utils.log(1, "processAccount()", "datadir => "+datadir+"-"+id)
        await utils.createDir(datadir+"-"+id);
        await utils.sleep(utils.rdn(2000, 5000))
        const browser = await puppeteer.launch({
            defaultViewport: null,
            headless:headless,
            args: [
                '--proxy-server='+proxy,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--user-data-dir='+datadir+"-"+id,
                '--window-size=1500,2000',
            ],
        });
        try {
            var page = await browser.newPage();
            await page.setViewport({ width: 1500, height: 2000 })
            await page.setDefaultNavigationTimeout(60000); 
            await page.goto('https://freebitco.in/?op=signup_page');
            await utils.sleep(utils.rdn(9000, 13000));
            // utils.log(1, 'processAccount()', email+" "+page.url());
            if (page.url() != "https://freebitco.in/?op=home") {
                page = await closePushModal(page, email);
                page = await closeSetCookie(page, email);
                await utils.sleep(utils.rdn(2000, 5000));
                page = await logIn(page, email, password).catch(e => {throw e});
                await utils.sleep(utils.rdn(2000, 5000));
                var element = await page.$("#reward_point_redeem_result_container_div > p > span.reward_point_redeem_result");
                var text = await page.evaluate(element => element.textContent, element);
                if (text != "Error message!") {
                    // utils.log(2, 'processAccount()', email+" "+text);
                    if (text.includes("Please check your email inbox")) {
                        await utils.sleep(utils.rdn(10000, 30000));
                        var link = await getVerificationLink(email, password, 0).catch((e) => { throw e});
                        await ipVerification(link, browser, email).catch((e) => {throw e});
                        pages = await browser.pages();
                        pages.map(async (page) => await page.close())
                        await browser.close();
                        // await utils.deleteDir(datadir+"-"+id)
                        await processAccount(email, password, proxy, id);
                        return resolve(0);
                    } else if (text.includes("Too many tries")) {
                        await Accounts.update({ message2: text, last_roll: new Date()}, {where: {email: email}});
                    } else {
                        await Accounts.update({ message1: text }, {where: {email: email}});
                    }
                    pages = await browser.pages();
                    pages.map(async (page) => await page.close())
                    await browser.close();
                    return resolve(0);
                }
            }
            await utils.sleep(utils.rdn(5000, 15000));
            page = await closeSetCookie(page, email);
            var balance = await getBalance(page, email).catch(e => {throw e});
            await Accounts.update({ balance: balance}, {where: {email: email}});
            await utils.sleep(utils.rdn(6000, 12000));
            page = await rollAccount(page, email, password).catch(e => {throw e});
            await utils.sleep(utils.rdn(6000, 12000));
            // await page.screenshot({path: path.resolve( __dirname, "./test2.png" )});
            await getWinnings(page, email);
            try {
                await page.waitForSelector('#free_play_error', {timeout: 30000});
                element = await page.$("#free_play_error");
                text = await page.evaluate(element => element.textContent, element);
                if (text.includes("You need to verify your email before you can play")) {
                    // utils.log(2, 'processAccount()', email+" "+text);
                    await utils.sleep(utils.rdn(10000, 30000));
                    var link = await getVerificationLink(email, password, 1);
                    await ipVerification(link, browser, email);
                    pages = await browser.pages();
                    pages.map(async (page) => await page.close())
                    await browser.close();
                    await processAccount(email, password, proxy, id);
                } else if (text.includes("You do not have enough reward points") || text.includes("Someone has already played")) {
                    // utils.log(2, 'processAccount()', email+" "+text);
                    await Accounts.update({ message2: text, last_roll: new Date()}, {where: {email: email}});
                } else if (text) {
                    // utils.log(2, 'processAccount()', email+" "+text);
                    await Accounts.update({ message1: text }, {where: {email: email}});
                }
                pages = await browser.pages();
                pages.map(async (page) => await page.close())
                await browser.close();
                return resolve(0);
            } catch (e) {
                // utils.log(1, 'processAccount()', email+" no error detected on roll "+e);
            }
            var balance = await getBalance(page, email).catch(e => {throw e});
            await Accounts.update({ balance: balance, message1: '', message2: '' }, {where: {email: email}});
            utils.log(3, 'processAccount()', email+' success');
            pages = await browser.pages();
            pages.map(async (page) => await page.close())
            await browser.close();
        } catch (e) {
            await Accounts.update({ message2: e.message }, {where: {email: email}});
            // utils.log(3, 'processAccount()', email+' '+e);
            utils.log(3, 'processAccount()', email+' error');
            pages = await browser.pages();
            pages.map(async (page) => await page.close())
            await browser.close();
        } finally {
            await Accounts.update({last_roll: new Date()}, {where: {email: email}});
            await utils.sleep(utils.rdn(6000, 12000));
            await utils.deleteDir(datadir+"-"+id)
            return resolve(0);
        }
    });
}

async function processAvailableAccounts() {
    return new Promise(async resolve => {
        var promiseTab = [];
        try {
            utils.printTitle(nb_iter);
            var start = new Date().getTime();
            var d = new Date();
            d.setHours(d.getHours() - 1);
            var i = 0;
            var accounts = await Accounts.findAll({where: {[Op.and]: [{ last_roll: {[Op.lte]: d}}, {message1: ''}]}, order: [['type', 'ASC']]});
            var accLength = accounts.length;
            // var proxies = await Proxies.findAll({where: {[Op.and]: [{ up: true }, { delay_ms: {[Op.lte]: 10000}}]}, order: [['delay_ms', 'ASC']]});
            // proxies = utils.shuffle(proxies);
            winnings = 0;
            nb_roll = 0;
            utils.log(1, "processAvailableAccounts()", "try to roll "+accounts.length+" accounts");
            while(accounts.length) {
                chunk = accounts.splice(0, nb_acc);
                for (elem of chunk) {
                    // var proxyUrl = proxies[i].protocol+"://"+proxies[i].ip+":"+proxies[i].port;
                    var testProxy = await checkProxy(elem.proxy);
                    if (testProxy == 1) {
                        var current_email = elem.email; // bug bizarre
                        utils.log(1, "processAvailableAccounts()", "process account: "+current_email+" whith proxy: "+elem.proxy);
                        promiseTab.push(processAccount(current_email, elem.password, elem.proxy, elem.id));
                    }
                    i++;
                }
                await Promise.all(promiseTab);
            }
            var end = new Date().getTime();
            var time = end - start;
        } catch (e) {
            utils.log(3, 'processAvailableAccounts()', e);
        } finally {
            utils.log(1, "processAvailableAccounts()", nb_roll+"/"+accLength+" roll - total winnings = "+Number(winnings).toFixed(8)+" exec time = "+utils.timeConversion(time));
            utils.log(1, "processAvailableAccounts()", "wait for 20 seconds")
            await utils.sleep(20000);
            resolve(0);
        }
    });
}

async function run() {
    
    var isCron = false;

    utils.log(1, 'run()', 'starting ...');

    await init();

    // await getFreeProxies();
    await getProxies();
    await checkAllProxies();
    await assignProxies();
    
    cron.schedule('07 22 * * *', async () => {
        await init();
        isCron = true;
        console.log('Running Cron ... ');
        await checkAllProxies();
        await assignProxies();
        isCron = false;
    });
    
    while (1) {
        if (!isCron) {
            utils.log(1, 'run()', 'start rolling accounts');
            nb_iter++;
            await processAvailableAccounts();
        }
    }

    // await getVerificationLink('17j4ck.1@gmail.com', 'test1234&', 0)
    // await captchaSolver.test();
    // await processAccount("17j4ck.3@gmail.com", 'test1234&', '', '', '', 1);
}

run();
