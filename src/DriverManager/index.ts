import {initDriver, LaunchOptions, DriverType, PageType, Utils} from './Puppeteer';
import moment from 'moment';
import path from 'path';

type DriverAction = (manager: DriverManager) => Promise<any>

class DriverManagerBase {
    protected options = {
        resultsLocation: path.join(process.cwd(), './results'),
        blockImages: true,
    }
    protected resolver: any;
    protected driverActionChain = new Promise<DriverManager>((resolve) => {
        this.resolver = resolve;
        return this;
    });

    protected constructor(protected driver: DriverType, protected currentPage: PageType) { 
        currentPage.setRequestInterception(true).then(() => {
            currentPage.on('request', interceptedRequest => {
                if (interceptedRequest.url().endsWith('.png') || interceptedRequest.url().endsWith('.jpg')) {
                    interceptedRequest.abort();
                }
                else {
                    interceptedRequest.continue();
                }
                interceptedRequest.continue();
            });
        })

    }

    private async saveAndFail(error:any, actionType: string, args?: object) {
        console.log(`>>Exception thrown in "${actionType}"\n>>Args: ${JSON.stringify(args)}\n>>Message:\n>>${error.message || error}`);
        console.log(`>>Saving state to ${path.join(this.options.resultsLocation, 'failed-contents.html')}`);
        await Utils.savePageContents(
            this.currentPage,
            path.join(this.options.resultsLocation), 
            'failed-contents.html'
        );
        await this.driver.close();

    }

    protected appendDriverActionChain(newAction: DriverAction, actionType: string, args?: object) {
        this.driverActionChain = this.driverActionChain.then(async manager => {
            console.log('Running action: ', actionType);
            try {
                await newAction(manager);
                return manager;
            } catch(error) {
                this.saveAndFail(error, actionType, args);
                throw error;
            }
        });
    }
}

export default class DriverManager extends DriverManagerBase {

    constructor(protected driver: DriverType, protected currentPage: PageType) {
        super(driver, currentPage);
    }

    public waitForElement(selector: string, opts?: {timeout?: number, noRaiseOnFail?: boolean}) {
        this.appendDriverActionChain(async manager => {
            try {
                await manager.currentPage.waitForSelector(selector, {timeout: opts?.timeout});
            } catch(error) {
                if (!opts?.noRaiseOnFail) {
                    throw error;
                }
            }
            return manager;
        }, 'waitForElement', {selector: selector, opts: opts})
        return this;
    }

    public click(selector: string, opts?: object) {
        this.appendDriverActionChain(async manager => {
            await manager.currentPage.click(selector);
        }, 'click');
        return this;
    }

    public goto(url: string) {
        this.appendDriverActionChain(async manager => {
            await manager.currentPage.goto(url);
        }, 'goto', {url: url})
        return this;
    }

    public screenshot() {
        this.appendDriverActionChain(async manager => {
            await Utils.saveScreenshot(manager.currentPage, manager.options.resultsLocation, '');
        }, 'screenshot', {path: path})
        return this;
    }

    public wait(ms: number) {
        this.appendDriverActionChain(async manager => {
            await manager.currentPage.waitFor(ms);
        }, 'wait', {ms: ms})
        return this;
    }

    public close() {
        this.appendDriverActionChain(async manager => await manager.driver.close(), 'close');
        return this;
    }

    public savePage() {
        this.appendDriverActionChain(async manager => {
            await Utils.savePageContents(manager.currentPage, manager.options.resultsLocation, 'contents.html');
        }, 'savePage')
        return this;
    }

    public loadPage(fileName?: string) {
        this.appendDriverActionChain(async manager => {
            await Utils.loadPageContents(manager.currentPage, manager.options.resultsLocation, fileName || 'contents.html');
        }, 'loadPage')
        return this;
    }

    public parseExternalLinks() {
        this.appendDriverActionChain(async manager => {
            await manager.currentPage.waitForSelector('*[href]');
            const links = await manager.currentPage.$$eval('*[href]', aElems => aElems.map(aElem => aElem.getAttribute('href')));
            const hostname = new URL(await manager.currentPage.url()).origin;
            console.log('Link count: ', links.length);
            for (let link of links) {
                let linkFull = new URL(<string>link, hostname);
                try {
                    await manager.currentPage.goto(linkFull.toString());
                    console.log('SUCCESS');
                } catch(err) { console.log('Cannot go to page: ', err)}
            }
        }, 'parseExternalLinks')
        return this;
    }

    public execute() {
        this.resolver(this);
        return this.driverActionChain;
    }
}

/**
 * 
 * @param opts Launch options used to create the driver
 */
export async function initManager(opts?: LaunchOptions): Promise<DriverManager> {
    return new Promise(async (resolve) => {
        let driver = await initDriver(opts);
        resolve(new DriverManager(driver, (await driver.pages())[0]));
    });
}
