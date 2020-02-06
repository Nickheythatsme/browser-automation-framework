import {initDriver, LaunchOptions, DriverType, PageType} from './Puppeteer';
import fs from 'fs';
import path from 'path';

type DriverAction = (manager: DriverManager) => Promise<DriverManager>

export default class DriverManager {
    private resolver: any;
    private driverActionChain: Promise<DriverManager> = new Promise<DriverManager>((resolve) => {
        this.resolver = resolve;
        return this;
    });

    static async initDriverManager(opts?: LaunchOptions): Promise<DriverManager> {
        return new Promise(async (resolve) => {
            let driver = await initDriver(opts);
            resolve(new DriverManager(driver, (await driver.pages())[0]));
        });
    }

    protected constructor(protected driver: DriverType, protected currentPage: PageType) {
        currentPage.setRequestInterception(true).then(() => {

            currentPage.on('request', interceptedRequest => {
                if (interceptedRequest.url().endsWith('.png') || interceptedRequest.url().endsWith('.jpg'))
                interceptedRequest.abort();
                else
                interceptedRequest.continue();
            });
        })
    }

    private appendDriverActionChain(newAction: DriverAction, actionType: string, args?: object) {
        this.driverActionChain = this.driverActionChain.then(async manager => {
            console.log('Running action: ', actionType);
            try {
                return await newAction(manager);
            } catch(error) {
                console.log(`>>Exception thrown in "${actionType}"\n>>Args: ${JSON.stringify(args)}\n>>Message:\n>>${error.message || error}`);
                console.log(`>>Saving state to ${new Date().toISOString()}-contents.html`);
                await DriverManager._savePage(`${new Date().toISOString()}-contents.html`, manager);
                await manager.driver.close();
                throw error;
            }
        });
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
            return manager;
        }, 'click');
        return this;
    }

    public goto(url: string) {
        this.appendDriverActionChain(async manager => {
            await manager.currentPage.goto(url);
            return manager;
        }, 'goto', {url: url})
        return this;
    }

    public screenshot(dir?: string) {
        this.appendDriverActionChain(async manager => {
            let _dir: string = path.join(process.cwd(), dir || './results/screenshots');
            let filename: string = `${new Date().toISOString()}.png`;
            if(!fs.existsSync(_dir)) {
                fs.mkdirSync(_dir, {recursive: true});
            }
            console.log('Saving screen shot to: ', path.join(_dir, filename))
            await manager.currentPage.screenshot({path: path.join(_dir, filename), type: 'png'});
            return manager;
        }, 'screenshot', {path: path})
        return this;
    }

    public wait(ms: number) {
        this.appendDriverActionChain(async manager => {
            console.log('Waiting');
            await manager.currentPage.waitFor(ms);
            console.log('Finished waiting');
            return manager;
        }, 'wait', {ms: ms})
        return this;
    }

    public close() {
        this.appendDriverActionChain(async manager => {
            manager.driver.close();
            return manager;
        }, 'close')
        return this;
    }

    static async _savePage(path: string, manager: DriverManager) {
        fs.writeFileSync(path, await manager.currentPage.content());
    }

    public savePage(path?: string) {
        this.appendDriverActionChain(async manager => {
            await DriverManager._savePage(path || 'contents.html', manager);
            return manager;
        }, 'savePage')
        return this;
    }

    public loadPage(path?: string) {
        this.appendDriverActionChain(async manager => {
            let content: string = fs.readFileSync(path || 'contents.html', {encoding: 'utf8'});
            await manager.currentPage.setContent(content.toString());
            return manager;
        }, 'loadPage')
        return this;
    }

    public execute() {
        this.resolver(this);
        return this.driverActionChain;
    }
}
