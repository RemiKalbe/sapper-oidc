const puppeteer = require('puppeteer');
const handleLoginAndConsent = require("./helpers/handleLoginAndConsent");

(async () => {
    console.log("Test: navigate_while_logged_in.js");
    const browser = await puppeteer.launch();
    const page = await browser.newPage();


   await page.goto('http://localhost:3001', {waitUntil: 'networkidle2'});
   await page.click('#login');
   await page.waitForNavigation({ waitUntil: 'networkidle2' });
   await handleLoginAndConsent(page, false, false);

   const el = await page.$("h1");
   await page.waitForTimeout(1000);
   const t = await page.evaluate(element => element.textContent, el);
   if (t !== "Yes") {
        console.log("No 'yes'");
        process.exit(1);
    }

    /*

        TEST 1

    */

   console.log("-> Test 1");
    
   await page.goto('http://localhost:3001', {waitUntil: 'networkidle2'});
   await page.click('#PPR');

   await page.waitForSelector('h1', {timeout: 3000});
   await page.waitForTimeout(1000);
   const element = await page.$("h1");
   const text = await page.evaluate(element => element.textContent, element);
   if (text !== "Yes PPR") {
        console.log("No 'Yes PPR'");
        process.exit(1);
    }

   console.log("    Result: OK");

   /*

       TEST 2

   */

  console.log("-> Test 2");
       
   await page.goto('http://localhost:3001', {waitUntil: 'networkidle2'});
   await page.click('#PPRD');

   await page.waitForSelector('h1', {timeout: 3000});
   await page.waitForTimeout(1000);
   const element2 = await page.$("h1");
   const text2 = await page.evaluate(element => element.textContent, element2);
   if (text2 !== "Yes PPRD") {
        console.log("No 'Yes PPRD'");
        process.exit(1);
    }

   console.log("    Result: OK");

   /*

       TEST 3

   */

  console.log("-> Test 3");
           
   await page.goto('http://localhost:3001', {waitUntil: 'networkidle2'});
   await page.click('#PPNR');

   await page.waitForSelector('h1', {timeout: 3000});
   await page.waitForTimeout(1000);
   const element3 = await page.$("h1");
   const text3 = await page.evaluate(element => element.textContent, element3);
   if (text3 !== "Yes PPNR") {
        console.log("No 'Yes PPNR'");
        process.exit(1);
    }

   console.log("    Result: OK");

   /*

       TEST 4

   */
  console.log("-> Test 4");
               
   await page.goto('http://localhost:3001', {waitUntil: 'networkidle2'});
   await page.click('#NPPNR');

   await page.waitForSelector('h1', {timeout: 3000});
   await page.waitForTimeout(1000);
   const element4 = await page.$("h1");
   const text4 = await page.evaluate(element => element.textContent, element4);
   if (text4 !== "Yes NPPNR") {
        console.log("No 'Yes NPPNR'");
        process.exit(1);
    }

   console.log("    Result: OK");

    await browser.close();
  })();