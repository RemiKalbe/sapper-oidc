const puppeteer = require('puppeteer');
const handleLoginAndConsent = require("./helpers/handleLoginAndConsent");

(async () => {
    console.log("Test: silent_login.js");
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.deleteCookie({name: "SID", url: "http://localhost:3001"});
    
    await page.goto('http://localhost:3001', {waitUntil: 'networkidle2'});
    await page.click('#login');
    await page.waitForNavigation({ waitUntil: 'networkidle2' });
    await handleLoginAndConsent(page, true, true);

    await page.waitForSelector('h1', {timeout: 3000});
    const element = await page.$("h1");
    const text = await page.evaluate(element => element.textContent, element);
    if (text !== "Yes") throw new Error("No 'yes'");
    
    await page.deleteCookie({name: "SID", url: "http://localhost:3001"});
    await page.goto('http://localhost:3001', {waitUntil: 'networkidle2'});

    await page.waitForSelector('h1', {timeout: 3000});
    const element2 = await page.$("h1");
    const text2 = await page.evaluate(element => element.textContent, element2);
    if (text2 !== "Yes") throw new Error("No 'yes'");
    console.log("    Result: OK");

    await browser.close();
  })();