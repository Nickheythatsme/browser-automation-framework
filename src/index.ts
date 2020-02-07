import DriverManager, {initManager} from './DriverManager';

async function runTest(instance: number) {
    let driverManager = await initManager({headless: false});
    let r = await driverManager
        .goto('https://reddit.com/r/news')
        .parseExternalLinks()
        .close()
        .execute();
}

runTest(0).then(() => console.log(`finished: ${0}`)).catch(err => console.log(`errored: ${err}`));
