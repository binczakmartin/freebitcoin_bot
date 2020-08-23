const request = require('request');
const sequelize = require('sequelize');
const db = new sequelize("mysql://root:test1234&@localhost:3306/freebitcoin");
const { Op } = require('sequelize');
const https = require('https');
const querystring = require('querystring');
const SocksProxyAgent = require('socks-proxy-agent');
const puppeteer = require('puppeteer');
const imaps = require('imap-simple');
const _ = require('lodash');
const path = require('path');
const fs = require('fs');

const headless = true;
db.options.logging = false;

var winnings = 0;

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
    last_cashout: { type: sequelize.DATE },
    type: { type: sequelize.BOOLEAN},
    btc_addr: { type: sequelize.STRING },
    refferer: { type: sequelize.INTEGER },
    last_ip: { type: sequelize.STRING },
    message: { type: sequelize.STRING }
}, {
    underscored: true,
    paranoid: true,
    freezeTableName: true,
    tableName: 'accounts'
});

function printTitle() {
    console.log('\033c');
    var str = "\x1b[38;5;134m .d888                          888      888\n"
    +"d88P\"                           888      888\n"
    +"888                             888      888\n"
    +"888888 888d888 .d88b.   .d88b.  88888b.  888888 .d8888b\n"
    +"888    888P\"  d8P  Y8b d8P  Y8b 888 \"88b 888   d88P\"\n"
    +"888    888    88888888 88888888 888  888 888   888\n"
    +"888    888    Y8b.     Y8b.     888 d88P Y88b. Y88b.\n"
    +"888    888     \"Y8888   \"Y8888  88888P\"   \"Y888 \"Y8888P \x1b[0m\n";
    console.log(str);
}

function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;
  while (0 !== currentIndex) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }
  return array;
}

function log(type, function_name, message) {
    var str = "";
    if (type == 1) {
      str = "\x1b[38;5;226m[INFO]\x1b[0m "+new Date().toISOString().slice(0, 23).replace('T',' ');
    } else if (type == 2) {
      str = "\x1b[38;5;208m[WARNING]\x1b[0m "+new Date().toISOString().slice(0, 23).replace('T',' ');
    } else if (type == 3) {
      str = "\x1b[38;5;9m[ERROR]\x1b[0m "+new Date().toISOString().slice(0, 23).replace('T',' ');
    }
    str = str + " - \x1b[38;5;240m"+function_name+" \x1b[0m"+message;
    console.log(str);
}

async function init() {
    printTitle();
    log(1, 'init()', 'sync proxies table');
    await Proxies.sync({force: false});
    log(1, 'init()', 'sync accounts table');
    await Accounts.sync({force: false});
}

function timeConversion(millisec) {
   var seconds = (millisec / 1000).toFixed(1);
   var minutes = (millisec / (1000 * 60)).toFixed(1);
   var hours = (millisec / (1000 * 60 * 60)).toFixed(1);
   var days = (millisec / (1000 * 60 * 60 * 24)).toFixed(1);
   if (seconds < 60) {
       return seconds + " Sec";
   } else if (minutes < 60) {
       return minutes + " Min";
   } else if (hours < 24) {
       return hours + " Hrs";
   } else {
       return days + " Days"
   }
}

function makeInscriptionCode(length) {
  var result           = '';
  var characters       = 'abcdefghijklmnopqrstuvwxyz';
  var charactersLength = characters.length;
  for ( var i = 0; i < length; i++ ) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testPage(ip, port) {
    return new Promise(function(resolve, reject) {
        try {
            const info = {
                host: ip,
                port: port,
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
    log(1, 'getProxies()', 'truncate proxies table');
    await Proxies.destroy({where: 1, truncate: true});
    var directory = path.normalize(__dirname+'/proxies');
    await insertProxies('socks5', path.normalize( directory+'/proxyscrape_10000_socks5_proxies.txt'));
}

async function getFreeProxies() {
    log(1, 'getFreeProxies()', 'truncate proxies table');
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
            });            const page = await browser.newPage();
            await page._client.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: directory
            });
            log(1, 'getFreeProxies()', 'https://www.proxyscan.io/');
            await page.goto('https://www.proxyscan.io/');
            await page.click('#layout-wrapper > div > div.page-content > div > div:nth-child(1) > div > div > ul > li:nth-child(3) > p > a');
            await page.click('#layout-wrapper > div > div.page-content > div > div:nth-child(1) > div > div > ul > li:nth-child(4) > p > a');
            await sleep(5000);
            await insertProxies('socks4', path.normalize(directory+'/SOCKS4-proxies.txt'));
            await insertProxies('socks5', path.normalize( directory+'/SOCKS5-proxies.txt'));
            log(1, 'getFreeProxies()', 'https://proxyscrape.com/free-proxy-list');
            await page.goto('https://proxyscrape.com/free-proxy-list');
            await sleep(2000);
            await page.click('#downloadsocks4');
            await page.click('#downloadsocks5');
            await sleep(5000);
            await browser.close();
            await insertProxies('socks4', path.normalize(directory+'/socks4_proxies.txt'));
            await insertProxies('socks5', path.normalize( directory+'/socks5_proxies.txt'));
            var str = ''
            var options = {
                host: 'www.proxyrack.com',
                path: '/proxyfinder/proxies.json?page=1&perPage=100000&offset=0'
            };
            log(1, 'getFreeProxies()', 'https://www.proxyrack.com/proxyfinder/proxies.json?page=1&perPage=1000000&offset=0');
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
                    log(3, 'getFreeProxies()', err);
                    resolve(0);
                });
            });
            request.setTimeout( 60000, function( ) {
                resolve(0);
            });
            resolve(0);
        } catch (e) {
            log(3, 'getFreeProxies()', e);
            resolve(0);
        }
    })
}

async function insertProxies(type, filename) {
    return new Promise(async (resolve) => {
        try {
            log(1, 'insertProxies()', filename)
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
            log(3, 'insertProxies()', e);
            resolve(0);
        }
    })
}

async function checkProxy(type, ip, port) {
    return new Promise(async resolve => {
        var proxyUrl = type+"://"+ip+":"+port
        var start = new Date().getTime();
        var testRes = await testPage(ip, port);
        var end = new Date().getTime();
        var time = end - start;
        if (testRes == 0) {
            await Proxies.update({ up: false, delay_ms: null, last_up: null }, {
                where: {[Op.and]: [{ ip: ip }, { port: port }]}}
            );
            log(1, 'checkProxy()', proxyUrl+'\x1b[38;5;160m KO\x1b[0m');
            resolve(0);
        } else {
            await Proxies.update({ up: true, last_up: new Date(), delay_ms: time }, {
                where: {[Op.and]: [{ ip: ip }, { port: port }]}}
            );
            log(1, 'checkProxy()', proxyUrl+'\x1b[38;5;34m OK\x1b[0m');
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
            chunk = proxies.splice(0, 1000);
            for (elem of chunk) {
                promiseTab.push(checkProxy(elem.protocol, elem.ip, elem.port));
            }
            await Promise.all(promiseTab);
        }
        resolve(1);
    })
}

function getVerificationLink(email, password) {
    return new Promise(async resolve => {
        try {
            var host = 'imap.gmail.com'
            var index = 0;
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
            log(1, 'getVerificationLink()', email+' '+host);
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
                    connection.search(searchCriteria, fetchOptions).then( function (messages) {
                        if (messages.length == 0) {
                            log(2, 'getVerificationLink()', email+' no new message received');
                            resolve(0);
                        } else {
                            if (messages[messages.length-1].parts[index].body.includes("https://freebitco.in/?op=email_verify&i")) {
                                var tab = messages[messages.length-1].parts[index].body
                                          .match(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)/gm)
                                for (elem of tab) {
                                    if (elem.indexOf("https://freebitco.in/?op=email_verify") !== -1) {
                                        log(1, 'getVerificationLink()', email+" "+elem);
                                        resolve(elem);
                                    }
                                }
                                resolve(0);
                            } else {
                                log(2, 'getVerificationLink()', email+' no message received from freebitco.in');
                                resolve(0);
                            }
                        }
                    }).catch(e => {
                        log(3, 'getVerificationLink()', email+" "+e);
                        resolve(0);
                    });
                }).catch(e => {
                    log(3, 'getVerificationLink()', email+" "+e);
                    resolve(0);
                });
            }).catch(e => {
                log(3, 'getVerificationLink()', email+" "+e);
                resolve(0);
            });
        }
        catch(e) {
            log(3, 'getVerificationLink()', email+" "+e);
            resolve(0);
        }
    });
}

async function ipVerification(link, browser, email) {
    return new Promise(async resolve => {
        try {
            const page = await browser.newPage();
            await page.setDefaultNavigationTimeout(600000);
            await page.goto(link);
            await page.waitForSelector('body > center > div > input[type=button]:nth-child(2)', {timeout: 600000});
            await page.click('body > center > div > input[type=button]:nth-child(2)');
            await page.bringToFront();
            await sleep(10000);
            await page.goto('about:blank');
            await page.close;
        } catch (e) {
            log(3, 'ipVerification()', email+' '+e);
        } finally {
            resolve(0);
        }
    });
}

function rollAccount(email, password, protocol, ip, port) {
    return new Promise(async resolve => {
        const browser = await puppeteer.launch({
            headless:headless,
            args: [
                '--proxy-server='+protocol+'://'+ip+':'+port,
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ],
        });
      try {
          const page = await browser.newPage();
          await page.setDefaultNavigationTimeout(600000);
          await page.goto('https://freebitco.in/?op=signup_page');
          log(1, 'rollAccount()', email+" "+page.url());
          await sleep(10000);
          try {
              await page.waitForSelector("#push_notification_modal > div.push_notification_big > div:nth-child(2) > div > div.pushpad_deny_button", {timeout: 600000});
              var element = await page.$("#push_notification_modal > div.push_notification_big > div:nth-child(2) > div > div.pushpad_deny_button");
              log(1, 'rollAccount()', email+" click notification modal button");
              await element.click();
              await page.waitForSelector("body > div.cc_banner-wrapper > div > a.cc_btn.cc_btn_accept_all", {timeout: 600000});
              element = await page.$("body > div.cc_banner-wrapper > div > a.cc_btn.cc_btn_accept_all");
              log(1, 'rollAccount()', email+" click cookies banner button");
              await element.click();
          } catch (e) {
              log(1, 'rollAccount()', email+" no notification modal or cookies banner");
          }
          await sleep(3500);
          log(1, 'rollAccount()', email+" click login menu button");
          await page.waitForSelector("body > div.large-12.fixed > div > nav > section > ul > li.login_menu_button > a", {timeout: 600000});
          element = await page.$("body > div.large-12.fixed > div > nav > section > ul > li.login_menu_button > a");
          await element.click();
          await sleep(5000);
          log(1, 'rollAccount()', email+" fill email");
          await page.waitForSelector('#login_form_btc_address', {timeout: 600000});
          await page.evaluate((text) => { (document.getElementById('login_form_btc_address')).value = text; }, email);
          await sleep(2000);
          log(1, 'rollAccount()', email+" fill password '"+password+"'");
          await page.waitForSelector('#login_form_password', {timeout: 600000});
          await page.evaluate((text) => { (document.getElementById('login_form_password')).value = text; }, password);
          log(1, 'rollAccount()', email+" click login button");
          await sleep(2000);
          await page.waitForSelector('#login_button', {timeout: 600000});
          element = await page.$("#login_button");
          await element.click();
          await sleep(10000);
          element = await page.$("#reward_point_redeem_result_container_div > p > span.reward_point_redeem_result");
          var text = await page.evaluate(element => element.textContent, element);
          if (text != "Error message!") {
              log(2, 'rollAccount()', email+" "+text);
              await Accounts.update({ message: text }, {where: {email: email}});
              if (text.indexOf("Please check your email inbox") !== -1) {
                  sleep(30000);
                  var link = await getVerificationLink(email, password);
                  await ipVerification(link, browser, email);
                  await browser.close();
                  await rollAccount(email, password, protocol, ip, port);
                  resolve(0);
              }
              await browser.close();
              resolve(0);
          }
          await sleep(5000);
          log(1, 'rollAccount()', email+" click play without captcha button");
          await page.waitForSelector('#play_without_captchas_button', {timeout: 600000});
          element = await page.$("#play_without_captchas_button");
          await element.click();
          await sleep(2000);
          log(1, 'rollAccount()', email+" click roll button");
          await page.waitForSelector('#free_play_form_button', {timeout: 600000});
          element = await page.$("#free_play_form_button");
          await element.click();
          await sleep(5000);
          log(1, 'rollAccount()', email+" check balance");
          try {
              await page.waitForSelector('#winnings', {timeout: 600000});
              element = await page.$("#winnings");
              text = await page.evaluate(element => element.textContent, element);
              var acc_winnigs = Number(text).toFixed(8);
              winnings += acc_winnigs;
              log(1, "rollAccount()", " roll winnings "+winnings)
          } catch (e) {
              log(1, 'rollAccount()', email+" can't get winnings");
          }
          await page.waitForSelector('#balance', {timeout: 600000});
          element = await page.$("#balance");
          text = await page.evaluate(element => element.textContent, element);
          var balance = text.split('&nbsp;')[0];
          log(1, 'rollAccount()', email+" balance = "+balance);
          await Accounts.update({ balance: balance, last_cashout: new Date(), message: '' }, {where: {email: email}});
          await browser.close();
      } catch (e) {
          log(3, 'rollAccount()', email+' '+e);
          await browser.close();
      } finally {
          resolve(0);
      }
    });
}

async function rollAllAccounts() {
    return new Promise(async resolve => {
        var promiseTab = [];
        try {
            winnings = 0;
            var accounts = await Accounts.findAll({});
            var i = 0;
            var proxies = await Proxies.findAll({where: {[Op.and]: [{ up: true }, { delay_ms: {[Op.lte]: 10000}}]}, order: [['delay_ms', 'ASC']]});
            log(1, "rollAllAccounts()", proxies.length+" available proxies");
            while(accounts.length) {
                chunk = accounts.splice(0, 10);
                for (elem of accounts) {
                    if (proxies[i] === undefined) {
                        break;
                    }
                    var proxyUrl = proxies[i].protocol+"://"+proxies[i].ip+":"+proxies[i].port;
                    var testProxy = await checkProxy(proxies[i].protocol, proxies[i].ip, proxies[i].port);
                    if (testProxy == 1) {
                        promiseTab.push(rollAccount(elem.email, elem.password, proxies[i].protocol, proxies[i].ip, proxies[i].port));
                        var current_email = elem.email; // bug bizarre
                        await Accounts.update({ last_ip: proxies[i].ip }, {where: {email: current_email}});
                    }
                    i++;
                }
                await Promise.all(promiseTab);
            }
            console.log(1, "rollAllAccounts()", "total winnings = "+Number(winnigs).toFixed(8));
        } catch (e) {
            log(3, 'rollAllAccounts()', e);
        } finally {
            resolve(0);
        }
    });
}

async function run() {
    var start = new Date().getTime();

    log(1, 'run()', 'starting ...');

    await init();
    // await getFreeProxies();
    await getProxies();
    await checkAllProxies();

    log(1, 'run()', 'start rolling accounts');
    await rollAllAccounts();

    var end = new Date().getTime();
    var time = end - start;

    console.log('\nExecution time: ' + timeConversion(time));
    process.exit(22);
}

run();
