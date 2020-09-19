const sequelize = require('sequelize');
const db = new sequelize("mysql://root:test1234&@151.80.140.49:3306/freebitcoin");
const { Op } = require('sequelize');
const puppeteer = require('puppeteer-extra');
const path = require('path');
const { sleep } = require('./utils');
const utils = require(path.resolve( __dirname, "./utils.js" ));
var random_name = require('node-random-name');
// const { is } = require('sequelize/types/lib/operators');
const captchaSolver = require(path.resolve( __dirname, "./captchaSolver.js" ))

const headless = false;
const datadir = path.resolve( __dirname, "./datadir" )

db.options.logging = false;

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

const monthTab = [
    "janvier", "février", "mars",
    "avril", "mai", "juin",
    "juillet", "août", "septembre",
    "octobre", "novembre", "décembre"
]

const resolution = [
    "1280,720",
    "800,600"
]

async function createEmail(username, password) {
    return new Promise(async (resolve) => {

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
        
        await utils.deleteDir(datadir);
        await utils.createDir(datadir);
        await utils.sleep(utils.rdn(2000, 5000))
        const browser = await puppeteer.launch({
            defaultViewport: null,
            headless:headless,
            args: [
                // '--proxy-server='+protocol+'://'+ip+':'+port,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--user-data-dir='+datadir,
                '--disable-features=site-per-process',
                '--window-size='+resolution[utils.rdn[0, resolution.length - 1]],
            ],
        });
        try {
            let frame1;
            let frame2;

            var page = await browser.newPage();
            await page.setBypassCSP(true)
            // await page.setViewport({ width: 1500, height: 2000 })
            await page.setDefaultNavigationTimeout(30000); 
            await page.goto("https://mail.protonmail.com/create/new?language=en");
            await utils.sleep(utils.rdn(9000, 13000));

            for (const frame of page.mainFrame().childFrames()){
                if (frame.url() == 'https://secure.protonmail.com/abuse.iframe.html?name=top') {
                    frame1 = frame;
                }
                if (frame.url() == 'https://secure.protonmail.com/abuse.iframe.html?name=bottom') {
                    frame2 = frame;
                }
                console.log(frame.url());
            }

            var inputUser = await frame1.$('#username');
            await inputUser.type(username);
            var email = username+"@protonmail.com";
            console.log("Email : "+email)
            await utils.sleep(utils.rdn(1000, 3000));

            var ipuntPwd1 = await page.$('#password');
            await ipuntPwd1.type(password);
            await utils.sleep(utils.rdn(1000, 3000));

            var ipuntPwd1 = await page.$('#passwordc');
            await ipuntPwd1.type(password);
            await utils.sleep(utils.rdn(1000, 3000));
            console.log("Password : "+password);

            let selector = "#app > div > footer > button";
            await frame2.evaluate((selector) => document.querySelector(selector).click(), selector);
            await utils.sleep(utils.rdn(1000, 3000));

            selector = "#confirmModalBtn";
            await page.waitForSelector(selector);
            await page.evaluate((selector) => document.querySelector(selector).click(), selector);
            await utils.sleep(utils.rdn(5000, 8000));

            for (const frame of page.mainFrame().childFrames()){
                console.log("test "+frame.url());
                console.log("trying to resolve the captcha")
                await captchaSolver.solve(frame).catch((e) => {throw e});
                await page.screenshot({path: path.resolve( __dirname, "./test.png" )});
            }

            await utils.sleep(utils.rdn(1000, 3000));

            selector = "#verification-panel > p.text-center.humanVerification-completeSetup > button";
            await page.waitForSelector(selector);
            await page.evaluate((selector) => document.querySelector(selector).click(), selector);
            await utils.sleep(utils.rdn(30000, 35000));
            await page.screenshot({path: path.resolve( __dirname, "./test1.png" )});

            selector = '#confirmModalBtn';
            await page.waitForSelector(selector);
            await page.evaluate((selector) => document.querySelector(selector).click(), selector);
            await utils.sleep(utils.rdn(5000, 8000));

            selector = '#pm_wizard > div > button';
            await page.waitForSelector(selector);
            await page.evaluate((selector) => document.querySelector(selector).click(), selector);
            await utils.sleep(utils.rdn(5000, 8000));

            await page.close();
            await browser.close();
            await sleep(5000);
            await utils.deleteDir(datadir)

            console.log("finish !");

            return resolve(1);

        } catch (e) {
            await page.screenshot({path: path.resolve( __dirname, "./test2.png" )});
            await sleep(1000);
            await page.close();
            await browser.close();
            await sleep(5000);
            await utils.deleteDir(datadir)
            console.log('error : '+e);
            return resolve(0);
        }
    })
}

async function checkmail(username, password) {
    return new Promise(async (resolve) => {

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
        
        await utils.createDir(datadir);
        await utils.sleep(utils.rdn(2000, 5000))
        const browser = await puppeteer.launch({
            defaultViewport: null,
            headless:headless,
            args: [
                // '--proxy-server='+protocol+'://'+ip+':'+port,
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--user-data-dir='+datadir,
                '--disable-features=site-per-process',
                '--window-size='+resolution[utils.rdn[0, resolution.length - 1]],
            ],
        });
        try {

            var page = await browser.newPage();
            await page.setBypassCSP(true)
            // await page.setViewport({ width: 1500, height: 2000 })
            await page.setDefaultNavigationTimeout(30000); 
            await page.goto("https://mail.protonmail.com/login");
            await utils.sleep(utils.rdn(9000, 13000));

            var inputUser = await page.$('#username');
            await inputUser.type(username);
            var email = username+"@protonmail.com";
            console.log("Email : "+email)
            await utils.sleep(utils.rdn(1000, 3000));

            var ipuntPwd1 = await page.$('#password');
            await ipuntPwd1.type(password);
            await utils.sleep(utils.rdn(1000, 3000));

            let selector = "#login_btn";
            await page.evaluate((selector) => document.querySelector(selector).click(), selector);
            await utils.sleep(utils.rdn(1000, 3000));

            try {
                selector = "#login > div.pm_modal.small > div.modal-dialog > div.modal-content > div.modal-header > h3"
                var text = await page.evaluate((selector) => document.querySelector(selector).textContent, selector);
                console.log("text = "+text);
                if (text == "Account disabled") {
                    resolve(0)
                }
            } catch (e) {}

            resolve(1);

            // await page.close();
            // await browser.close();
            // await sleep(5000);
            // await utils.deleteDir(datadir)

        } catch (e) {
            console.log(e);
            resolve(0)
        }
    });
}

async function run() {
    var username = utils.makeInscriptionCode(16);
    var password = utils.makePassword(10);
    var isEmailCreated = await createEmail(username, password);
    if (isEmailCreated) {
        await checkmail(username, password);
    }
    return 0;
}

run();