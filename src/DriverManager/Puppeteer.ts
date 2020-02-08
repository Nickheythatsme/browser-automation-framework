import puppeteer, { ClickOptions } from 'puppeteer';
import fs from 'fs';
import path from 'path';

export interface DriverType extends puppeteer.Browser { }

export interface PageType extends puppeteer.Page { }

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
    return new Promise<puppeteer.Browser>(async (resolve, reject) => {
        let browser: puppeteer.Browser;
        try {
            browser = await initPuppeteer(<LaunchOptions>opts);
            resolve(browser);
        } catch (error) {
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

export const Utils = {
    createDir: async (path: string) => {
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path, { recursive: true });
        }
    },
    savePageContents: async (page: PageType, savePath: string) => {
        Utils.createDir(savePath);
        let index = 0;
        let fullPath = path.join(savePath, 'contents.html');
        Utils.acquireFileLock(savePath);
        while (fs.existsSync(fullPath)) {
            fullPath = path.join(savePath, `${index}-contents.html`);
            ++index;
        }
        fs.writeFileSync(fullPath, await page.content());
        Utils.releaseFileLock(savePath);
        return fullPath;
    },
    loadPageContents: async (page: PageType, loadPath: string, filename: string) => {
        let content: string = fs.readFileSync(path.join(loadPath, filename), { encoding: 'utf8' });
        await page.setContent(content.toString());
    },
    acquireFileLock: async (dirPath: string) => {
        if (fs.existsSync(path.join(dirPath, 'lock'))) {
            await new Promise((resolve, reject) => {
                fs.watchFile(path.join(dirPath, 'lock'), { persistent: false }, () => {
                    if (!fs.existsSync(path.join(dirPath, 'lock'))) {
                        resolve();
                    }
                });
            })
        }
        fs.writeFileSync(path.join(dirPath, 'lock'), '');
    },
    releaseFileLock: async (dirPath: string) => {
        try {
            fs.unlinkSync(path.join(dirPath, 'lock'));
        } catch (err) { console.log('error removing lock'); throw err }
    },
    saveScreenshot: async (page: PageType, savePath: string) => {
        Utils.createDir(savePath);
        let index = 0;
        Utils.acquireFileLock(savePath);
        for (let fileName of fs.readdirSync(savePath, 'utf8')) {
            let num = Number.parseInt(fileName.split('.')[0]);
            if (num != Number.NaN && num >= index) {
                index = num + 1;
            }
        }
        let fullPath = path.join(savePath, `${index}.png`);
        await page.screenshot({ path: fullPath, type: 'png' })
        Utils.releaseFileLock(savePath);
        return fullPath;
    },
}
