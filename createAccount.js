const sequelize = require('sequelize');
const db = new sequelize("mysql://root:test1234&@151.80.140.49:3306/freebitcoin");
const { Op } = require('sequelize');
// const puppeteer = require('puppeteer');
const puppeteer = require('puppeteer-extra');
const imaps = require('imap-simple');
const _ = require('lodash');
const path = require('path');
const fs = require('fs');
const { sleep } = require('./utils');
const simpleParser = require('mailparser').simpleParser;
const utils = require(path.resolve( __dirname, "./utils.js" ));
var random_name = require('node-random-name');
const captchaSolver = require(path.resolve( __dirname, "./captchaSolver.js" ))

const headless = true;
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

async function createEmail(user, pwd) {
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
                // '--window-size='+resolution[utils.rdn[0, resolution.length - 1]],
            ],
        });
        try {
            var page = await browser.newPage();
            await page.setViewport({ width: 1500, height: 2000 })
            await page.setDefaultNavigationTimeout(60000); 
            await page.goto('https://compte.laposte.net/inscription/index.do?srv_gestion=lapostefr');
            await utils.sleep(utils.rdn(9000, 13000));
            
            var inputCivilityM = await page.$('#InscriptionForm > fieldset:nth-child(1) > ul > li:nth-child(1) > div > div:nth-child(1) > label > input');
            await inputCivilityM.click({ delay: utils.rdn(1000, 3000) })
            await utils.sleep(utils.rdn(1000, 3000));
            
            var name = random_name({ first: false, gender: "male" });
            var inputName = await page.$('#InscriptionForm > fieldset:nth-child(1) > ul > li:nth-child(2) > div > input');
            await inputName.type(name);
            await utils.sleep(utils.rdn(1000, 3000));

            var first = random_name({ first: true, gender: "male" });
            var inputFirst = await page.$('#InscriptionForm > fieldset:nth-child(1) > ul > li:nth-child(3) > div > input');
            await inputFirst.type(first);
            await utils.sleep(utils.rdn(1000, 2000));
            console.log("Name: "+first+" "+name)
            
            var bDay = utils.rdn(1, 27);
            bDay = bDay < 10 ? '0'+bDay : bDay;
            var bMonth = monthTab[utils.rdn(0, 11)];
            var bYear = utils.rdn(1978, 2002);

            console.log("Dob: "+bDay+"/"+bMonth+"/"+bYear)
            await page.select('#birthday > span:nth-child(1) > select', bDay.toString());
            await utils.sleep(utils.rdn(1000, 2000));
            await page.select('#birthday > span:nth-child(2) > select', bMonth);
            await utils.sleep(utils.rdn(1000, 2000));
            await page.select('#birthday > span:nth-child(3) > select', bYear.toString());
            await utils.sleep(utils.rdn(1000, 3000));

            var accounts = await Accounts.findAll({where: { email: {[Op.like]: '%laposte.net%'}}, order: [['id', 'DESC']]});
            var inputLastEmail = await page.$("#ipMail2");
            await inputLastEmail.type(accounts[0].email);
            console.log("Last Email: "+accounts[0].email);
            await utils.sleep(utils.rdn(1000, 3000));

            var codePost = utils.rdn(1, 20);
            codePost = codePost < 10 ? '7500'+codePost : "750"+codePost;
            await page.evaluate((text) => { (document.getElementById('ipCP')).value = text; }, codePost);
            console.log("CP: "+codePost);
            await utils.sleep(utils.rdn(1000, 3000));

            var username = utils.makeInscriptionCode(16);
            var email = username+"@laposte.net";
            var inputUser = page.$("#InscriptionForm > fieldset:nth-child(2) > ul > li:nth-child(1) > div > input");
            await page.evaluate((text) => { (document.getElementById('ipMail')).value = text; }, username);
            console.log("Email: "+email);
            await utils.sleep(utils.rdn(1000, 3000));

            var password = utils.makePassword(10);
            await page.evaluate((text) => { (document.getElementById('ipPwd')).value = text; }, password);
            await utils.sleep(utils.rdn(1000, 3000));
            await page.evaluate((text) => { (document.getElementById('ipPwd2')).value = text; }, password);
            console.log("Password: "+password);
            await utils.sleep(utils.rdn(1000, 3000));

            var inputCheckbox = await page.$("#conditionscbx");
            await inputCheckbox.click({ delay: utils.rdn(1000, 3000) })
            console.log("checkbox clicked");

            isCaptcha = await captchaSolver.solve(page.mainFrame()).catch((e) => {throw e});
            if (isCaptcha) {
                console.log("captcha OK")
                await page.screenshot({path: path.resolve( __dirname, "./test1.png" )});
                var submit1 = await page.$("#create-account-btn");
                await submit1.click({ delay: utils.rdn(1000, 3000) })
                await utils.sleep(utils.rdn(9000, 12000));
                var element = await page.$("#main > h1");
                var text = await page.evaluate(element => element.textContent, element);
                if (text.includes("vos informations personnelles")) {
                    console.log('verif OK 1');
                    var inputCivilityM = await page.$('#valider-btn');
                    await inputCivilityM.click({ delay: utils.rdn(1000, 3000) });
                    console.log('verif OK 2');
                } else {
                    console.log('verif KO');
                    await page.screenshot({path: path.resolve( __dirname, "./test2.png" )});
                    return resolve(0);
                }
            } else {
                console.log("captcha KO");
                await page.screenshot({path: path.resolve( __dirname, "./test2.png" )});
                return resolve(0);
            }

            await sleep(1000);
            await page.screenshot({path: path.resolve( __dirname, "./test2.png" )});
            await page.close();
            await browser.close();
            await sleep(5000);
            await utils.deleteDir(datadir)
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

async function run() {
    await createEmail("test", "");
}

run();