import Driver from './DriverManager';

Driver.initialize({ headless: true }).then(async driver => {
    await driver
        .goto('https://stackoverflow.com/questions/37042602/how-to-combine-object-properties-in-typescript')
        .screenshot()
        .click('a[href="https://stackexchange.com/questions?tab=hot"]', { timeout: 3000 })
        .click('f')
        .close()
        .perform()
});
