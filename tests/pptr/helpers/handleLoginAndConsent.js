async function handleLoginAndConsent(page, rememberMe, rememberConsent) {
    await page.type('#email', 'foo@bar.com');
    await page.type('#password', 'foobar');
    if (rememberMe){
        await page.evaluate(() => {
        document.querySelector("#remember").checked = true;
        });
    }
    await page.click('#accept');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 2000 }).catch((e) => {console.log(e)});;
    const url = await page.url();
    if(url.includes("consent")){
        await consent(page, rememberConsent);
    }
   
}

async function consent(page, rememberConsent){
    await page.evaluate(() => {
        document.querySelector("#openid").checked = true;
        document.querySelector("#profile").checked = true;
        document.querySelector("#offline").checked = true;
      });
      if (rememberConsent){
        await page.evaluate(() => {
        document.querySelector("#remember").checked = true;
        });
    }
    await page.click('#accept');
    await page.waitForNavigation({ waitUntil: 'networkidle2' }).catch((e) => {console.log(e)});;
}

module.exports = handleLoginAndConsent;