import puppeteer from 'puppeteer';

export interface DriverType extends puppeteer.Browser {}

export interface PageType extends puppeteer.Page {}

export interface LaunchOptions extends puppeteer.LaunchOptions {
    startPage?: string,
}

/**
 * Create a new browser driver. 
 * @param opts puppeteer options
 */
export function initDriver(opts?: LaunchOptions): Promise<puppeteer.Browser> {
    if (!opts) {
        opts = {};
    }
    return new Promise<puppeteer.Browser>( async (resolve, reject) => {
        let browser: puppeteer.Browser;
        try {
            browser = await initPuppeteer(<LaunchOptions>opts);
            resolve(browser);
        } catch(error) {
            console.error('Could not initialize browser: ', error.message || error);
            reject(error);
        }
    });
}

async function initPuppeteer(opts: LaunchOptions): Promise<puppeteer.Browser> {
    let browser = await puppeteer.launch({
        ...opts
    });
    if ((await browser.pages()).length < 1) {
        await browser.newPage();
    }
    if (opts.startPage) {
        (await browser.pages())[0].goto(opts.startPage);
    }
    return browser;
}
