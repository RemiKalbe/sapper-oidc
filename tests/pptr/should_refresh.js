const puppeteer = require('puppeteer');
const handleLoginAndConsent = require("./helpers/handleLoginAndConsent");

(async () => {
    console.log("Test: should_refresh.js");
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.deleteCookie({name: "SID", url: "http://localhost:3001"});
    
    await page.goto('http://localhost:3001', {waitUntil: 'networkidle2'});
    await page.click('#login');
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch((e) => {console.log(e)});;
    await handleLoginAndConsent(page, false, false);

    await page.waitForSelector('h1', {timeout: 3000});
    const element = await page.$("h1");
    const text = await page.evaluate(element => element.textContent, element);
    if (text !== "Yes") {
        console.log("No 'yes'");
        process.exit(1);
    }

    const element2 = await page.$("h2");
    const exp1 = await page.evaluate(element => element.textContent, element2);
    await page.waitForTimeout(exp1 * 1000 - Date.now());
    const element3 = await page.$("h2");
    const exp2 = await page.evaluate(element => element.textContent, element3);
    if (exp1 == exp2) {
        console.log("exp1 = exp2");
        process.exit(1);
    }
    console.log("    Result: OK");

    await browser.close();
  })();