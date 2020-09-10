const axios = require('axios')
const https = require('https')
const puppeteer = require('puppeteer-extra');
const path = require('path');
const datadir = path.resolve( __dirname, "./datadir" )
const utils = require(path.resolve( __dirname, "./utils.js" ));

module.exports = {
  async solve (page) {
    return new Promise(async (resolve, reject) => {
      try {

        let statusText;
        let recaptcha1;
        let recaptcha2;
        let i = 1;
        
        await utils.sleep(utils.rdn(2000, 7000));

        for (const frame of page.mainFrame().childFrames()){
          if (frame.url().includes('https://www.google.com/recaptcha/api2/anchor')){
            try {
              recaptcha1 = frame;
              var checkbox = await recaptcha1.$('#recaptcha-anchor')
              await checkbox.click({ delay: utils.rdn(1000, 5000) })
              var status = await frame.$('#recaptcha-accessible-status')
              statusText = await frame.evaluate(status => status.textContent, status);
              console.log("\ntest frame => "+frame.url());
              // console.log(statusText)
            } catch (error) {
              // console.log("test 12345 => "+error);
            }
          }
        }
  
        await utils.sleep(utils.rdn(3000, 6000))

        for (const frame of page.mainFrame().childFrames()) {
          if (frame.url().includes('https://www.google.com/recaptcha/api2/bframe')){
            recaptcha2 = frame 
            console.log("\ntest frame => "+frame.url());
          }
        }

        try {
          await utils.sleep(utils.rdn(1000, 3000))
    
          // console.log("check if captcha is validated");
          var status = await recaptcha1.$('#recaptcha-accessible-status')
          statusText = await recaptcha1.evaluate(status => status.textContent, status);
          if (statusText.includes("You are verified")) {
            // console.log(statusText);
            return resolve(1);
          } 
        } catch (e) {
          console.log("can't click on the recaptcha1 button")
        }

        
        try {
          var audioButton = await recaptcha2.$('#recaptcha-audio-button')
          await audioButton.click({ delay: utils.rdn(1000, 3000) })
        } catch (e) {
          console.log("cant't click play audio challenge")
        }
        
        
        while (!statusText.includes("You are verified") && i != 5) {
          console.log("loop "+i)
          // await recaptcha2.waitForSelector('#recaptcha-audio-button', {timeout: 30000});
          
          await utils.sleep(utils.rdn(1000, 3000))
          var element = await recaptcha2.$('body > div > div > div:nth-child(1) > div.rc-doscaptcha-body > div')
          if (element !== null) {
            text = await recaptcha2.evaluate(element => element.textContent, element);
            console.log(text);
            return resolve(0);
          }
          
          console.log("test1");
          // recaptcha2.waitForSelector('body > div > div > div.rc-audiochallenge-control > div > button', {timeout: 30000});
          // var playButton = await recaptcha2.$('body > div > div > div.rc-audiochallenge-control > div > button');
          // await playButton.click({ delay: utils.rdn(1000, 3000) })
          await recaptcha2.waitForSelector('#audio-source', {timeout: 30000});
          var selector = '#audio-source';
          var prop = "src";
          var audioLink = await recaptcha2.evaluate('document.querySelector("'+selector+'").getAttribute("'+prop+'")');
          console.log("test2");
          
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
          await utils.sleep(utils.rdn(2000, 7000));
  
          await recaptcha2.evaluate((text) => { (document.getElementById('audio-response')).value = text; },audioTranscript);
          var verifyButton = await recaptcha2.$('#recaptcha-verify-button');
          await verifyButton.click({ delay: utils.rdn(1000, 3000) });
  
          await utils.sleep(utils.rdn(3000, 5000));
  
          // console.log("check if captcha is validated");
          status = await recaptcha1.$('#recaptcha-accessible-status')
          statusText = await recaptcha1.evaluate(status => status.textContent, status);
          if (statusText.includes("You are verified")) {
            // console.log(statusText);
            return resolve(1);
          } else {
            
            try {
              var audioButton = await recaptcha2.$('#recaptcha-audio-button')
              await audioButton.click({ delay: utils.rdn(1000, 3000) })
            } catch (e) {
              // console.log("cant't click play audio challenge")
            }

            var verifyButton = await recaptcha2.$('#recaptcha-reload-button');
            await verifyButton.click({ delay: utils.rdn(1000, 3000) });
            i++;
          }
        }
        // console.log(statusText);
        if (statusText.includes("You are verified")) {
          return resolve(1);
        } else {
          return resolve(0);
        }
      } catch (e) {
        console.log(e)
        //reject(e);
        return resolve(0);
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
          // console.log(await browser.userAgent());
          await this.solve(page);
          await utils.sleep(10000)
          await page.close()
          await browser.close();
          return resolve(1);
      } catch (e) {
        console.log(e);
        return resolve(0);
      }
    });
  },
}
