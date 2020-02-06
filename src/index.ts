import DriverManager from './DriverManager';
import os from 'os';

async function runTest(instance: number) {
    let driverManager = await DriverManager.initDriverManager({headless: true});
    try {
        let r = await driverManager
            .loadPage()
            .wait(1000)
            .goto('https://airbnb.com')
            .goto('https://github.com')
            .wait(1000)
            .screenshot()
            .savePage()
            .waitForElement(':root')
            .click(':root')
            .click(':root')
            .execute();
        await r.close().execute();
    } catch(error) {
        console.error(`(${instance}) error: ${error}`);
    }
    console.log(`(${instance}) finished`);
}

let interval = setInterval(() => {console.log(`FREEMEM: ${os.freemem()}`)}, 500);
setTimeout(() => {clearInterval(interval)}, 300000, interval);

for (let i = 0; i<20; ++i) {
    runTest(i).then(() => console.log(`finished: ${i}`)).catch(() => console.log(`errored: ${i}`));
}
