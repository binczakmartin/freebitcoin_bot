const axios = require('axios')
const https = require('https')
// const puppeteer = require('puppeteer');
const puppeteer = require('puppeteer-extra');
const pluginStealth = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const datadir = path.resolve( __dirname, "./datadir" )

function rdn (min, max) {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min)) + min
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  async solve (page) {
    return new Promise(async (resolve, reject) => {
      try {
  
        let recaptcha1;
        let recaptcha2;
        await sleep(rdn(2000, 7000));

        for (const frame of page.mainFrame().childFrames()){
          if (frame.url().includes('https://www.google.com/recaptcha/api2/anchor')){
              try {
                await recaptcha1.waitForSelector('#recaptcha-anchor', {timeout: 30000});
                var status = await frame.$('#recaptcha-accessible-status')
                var statusText = await frame.evaluate(status => status.textContent, status);
                console.log(statusText)
                recaptcha1 = frame;
              } catch (error) {
                console.log("test 12345 => "+error);
              }
           }
           if (frame.url().includes('https://www.google.com/recaptcha/api2/bframe')){
            recaptcha2 = frame 
          }
          console.log("test frame => "+frame.url());
        }
  
        // console.log("get the recaptcha checkbox");
        await recaptcha1.waitForSelector('#recaptcha-anchor', {timeout: 30000});
        var checkbox = await recaptcha1.$('#recaptcha-anchor')
        await checkbox.click({ delay: rdn(1000, 5000) })

        await sleep(rdn(1000, 3000))
  
        // console.log("check if captcha is validated");
        var status = await recaptcha1.$('#recaptcha-accessible-status')
        var statusText = await recaptcha1.evaluate(status => status.textContent, status);
        if (statusText.includes("You are verified")) {
          // console.log(statusText);
          return resolve(1);
        } 

        // console.log("click audio challenge")
        await recaptcha2.waitForSelector('#recaptcha-audio-button', {timeout: 30000});
        var audioButton = await recaptcha2.$('#recaptcha-audio-button')
        await audioButton.click({ delay: rdn(1000, 3000) })

        await sleep(rdn(1000, 3000))
        var element = await recaptcha2.$('body > div > div > div:nth-child(1) > div.rc-doscaptcha-body > div')
        if (element !== null) {
          text = await recaptcha2.evaluate(element => element.textContent, element);
          console.log(text);
          return resolve(0);
        }

        recaptcha2.waitForSelector('body > div > div > div.rc-audiochallenge-control > div > button', {timeout: 30000});
        var playButton = await recaptcha2.$('body > div > div > div.rc-audiochallenge-control > div > button');
        await playButton.click({ delay: rdn(1000, 3000) })
        await recaptcha2.waitForSelector('#audio-source', {timeout: 30000});
        var selector = '#audio-source';
        var prop = "src";
        var audioLink = await recaptcha2.evaluate('document.querySelector("'+selector+'").getAttribute("'+prop+'")');
 
        // console.log("audiolink = "+audioLink);
        const audioBytes = await recaptcha2.evaluate(audioLink => {
          return (async () => {
            const response = await window.fetch(audioLink)
            // console.log("response = "+response)
            const buffer = await response.arrayBuffer()
            return Array.from(new Uint8Array(buffer))
          })()
        }, audioLink);

        const httsAgent = new https.Agent({ rejectUnauthorized: false })
        const response = await axios({
          httsAgent,
          method: 'post',
          url: 'https://api.wit.ai/speech?v=20170307',
          data: new Uint8Array(audioBytes).buffer,
          headers: {
            Authorization: 'Bearer JVHWCNWJLWLGN6MFALYLHAPKUFHMNTAC',
            'Content-Type': 'audio/mpeg3'
          }
        })
        const audioTranscript = response.data._text.trim()
        console.log('test12  '+audioTranscript);
        await sleep(rdn(2000, 7000));

        var audioResponse = recaptcha2.$('#audio-response');
        await recaptcha2.evaluate((text) => { (document.getElementById('audio-response')).value = text; },audioTranscript);
        var verifyButton = await recaptcha2.$('#recaptcha-verify-button');
        await verifyButton.click({ delay: rdn(1000, 3000) });

        await sleep(rdn(3000, 5000));

        // console.log("check if captcha is validated");
        status = await recaptcha1.$('#recaptcha-accessible-status')
        statusText = await recaptcha1.evaluate(status => status.textContent, status);
        if (statusText.includes("You are verified")) {
          console.log(statusText);
          return resolve(1);
        } 
        console.log(statusText);
        return resolve(0);
      } catch (e) {
        console.log(e)
        reject(e);
      }
    })
  },
  
  async test() {
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
        require('puppeteer-extra-plugin-stealth/evasions/iframe.contentWindow')(),
    );
    puppeteer.use(
        require('puppeteer-extra-plugin-stealth/evasions/media.codecs')(),
    );
    puppeteer.use(
        require('puppeteer-extra-plugin-stealth/evasions/navigator.languages')(),
    );
    /* this create bug in the bot */
    // puppeteer.use(
    //     require('puppeteer-extra-plugin-stealth/evasions/navigator.plugins')(),
    // );
    puppeteer.use(
        require('puppeteer-extra-plugin-stealth/evasions/navigator.webdriver')(),
    );
    puppeteer.use(
        require('puppeteer-extra-plugin-stealth/evasions/sourceurl')(),
    );
    puppeteer.use(
        require('puppeteer-extra-plugin-stealth/evasions/user-agent-override')(),
    );
      const browser = await puppeteer.launch({
          headless:false,
          args: [
              //'--proxy-server='+protocol+'://'+ip+':'+port,
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-web-security',
              '--user-data-dir='+datadir,
          ],
      });
      try {
          var page = await browser.newPage();
          await page.setDefaultNavigationTimeout(60000);
          await page.goto("https://www.google.com/recaptcha/api2/demo");
          console.log(await browser.userAgent());
          await this.solve(page);
          await sleep(600000)
          return resolve(1);
      } catch (e) {
        console.log(e);
        return resolve(0);
      }
    });
  },
}
