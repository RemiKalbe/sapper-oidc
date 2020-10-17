const puppeteer = require('puppeteer');
const handleLoginAndConsent = require("./helpers/handleLoginAndConsent");

(async () => {
    console.log("Test: navigate_to_protected_path.js");
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    /*

        TEST 1

    */
   console.log("-> Test 1")

    await page.deleteCookie({name: "SID", url: "http://localhost:3001"});
    
    await page.goto('http://localhost:3001/private-info', {waitUntil: 'networkidle2'});
    await handleLoginAndConsent(page, false, false);

    await page.waitForSelector('h1', {timeout: 3000});
    const element = await page.$("h1");
    const text = await page.evaluate(element => element.textContent, element);
    if (text !== "Yes PPR") throw new Error("No 'Yes PPR'");

    console.log("    Result: OK");

    /*

        TEST 2

    */
   console.log("-> Test 2");

    await page.deleteCookie({name: "SID", url: "http://localhost:3001"});
        
    await page.goto('http://localhost:3001/private-info/deeper', {waitUntil: 'networkidle2'});
    await handleLoginAndConsent(page, false, false);

    await page.waitForSelector('h1', {timeout: 3000});
    const element2 = await page.$("h1");
    const text2 = await page.evaluate(element => element.textContent, element2);
    if (text2 !== "Yes PPRD") throw new Error("No 'Yes PPRD'");

    console.log("    Result: OK");

    /*

        TEST 3

    */
   console.log("-> Test 3");

    await page.deleteCookie({name: "SID", url: "http://localhost:3001"});
            
    await page.goto('http://localhost:3001/privateOnlyHere', {waitUntil: 'networkidle2'});
    await handleLoginAndConsent(page, false, false);

    await page.waitForSelector('h1', {timeout: 3000});
    const element3 = await page.$("h1");
    const text3 = await page.evaluate(element => element.textContent, element3);
    if (text3 !== "Yes PPNR") throw new Error("No 'Yes PPNR'");

    console.log("    Result: OK");

    /*

        TEST 4

    */
   console.log("-> Test 4");

    await page.deleteCookie({name: "SID", url: "http://localhost:3001"});
                
    await page.goto('http://localhost:3001/privateOnlyHere/deeper', {waitUntil: 'networkidle2'});

    await page.waitForSelector('h1', {timeout: 3000});
    const element4 = await page.$("h1");
    const text4 = await page.evaluate(element => element.textContent, element4);
    if (text4 !== "No NPPNR") throw new Error("No 'No NPPNR'");

    console.log("    Result: OK");
    

    await browser.close();
  })();