import DriverManager from './DriverManager';

async function runTest(instance: number) {
    let driverManager = await DriverManager.initDriverManager({headless: false});
    let r = await driverManager
        .goto('https://airbnb.com')
        .wait(5000)
        .screenshot()
        .goto('https://github.com')
        .screenshot()
        .savePage()
        .goto('https://news.google.com')
        .loadPage()
        .waitForElement(':root')
        .click(':root')
        .click(':root')
        .click('ot')
        .close()
        .execute();
}

runTest(0).then(() => console.log(`finished: ${0}`)).catch(err => console.log(`errored: ${err}`));
