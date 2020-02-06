import {initDriver, LaunchOptions, DriverType, PageType} from './Puppeteer';
import fs from 'fs';
import path from 'path';

type DriverAction = (manager: DriverManager) => Promise<DriverManager>

export default class DriverManager {
    private driverActionChain: Promise<DriverManager> = Promise.resolve(this);

    static async initDriverManager(opts?: LaunchOptions): Promise<DriverManager> {
        return new Promise(async (resolve) => {
            let driver = await initDriver(opts);
            resolve(new DriverManager(driver, (await driver.pages())[0]));
        });
    }

    private constructor(private driver: DriverType, private currentPage: PageType) { }

    private appendDriverActionChain(newAction: DriverAction, actionType: string, args?: object) {
        this.driverActionChain = this.driverActionChain.then(async manager => {
            console.log('Running action: ', actionType);
            try {
                return await newAction(manager);
            } catch(error) {
                console.log(`Exception thrown in "${actionType}"\nArgs: ${JSON.stringify(args)}\nMessage:\n${error.message || error}`);
                await manager.driver.close();
                throw error;
            }
        });
    }

    waitForElement(selector: string, opts?: {timeout?: number, noRaiseOnFail?: boolean}) {
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

    click(selector: string, opts?: object) {
        this.appendDriverActionChain(async manager => {
            await manager.currentPage.click(selector);
            return manager;
        }, 'click');
        return this;
    }

    goto(url: string) {
        this.appendDriverActionChain(async manager => {
            await manager.currentPage.goto(url);
            return manager;
        }, 'goto', {url: url})
        return this;
    }

    screenshot(dir?: string) {
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

    wait(ms: number) {
        this.appendDriverActionChain(async manager => {
            await new Promise((resolve, reject) => {
                setTimeout(resolve, ms);
            });
            return manager;
        }, 'wait', {ms: ms})
        return this;
    }

    close() {
        this.appendDriverActionChain(async manager => {
            manager.driver.close();
            return manager;
        }, 'close')
        return this;
    }

    savePage() {
        this.appendDriverActionChain(async manager => {
            fs.writeFileSync(`contents.html`, await manager.currentPage.content());
            return manager;
        }, 'exp')
        return this;
    }

    loadPage() {
        this.appendDriverActionChain(async manager => {
            let content: string = fs.readFileSync('contents.html', {encoding: 'utf8'});
            await manager.currentPage.setContent(content.toString());
            return manager;
        }, 'loadPage')
        return this;
    }

    execute() {
        return this.driverActionChain;
    }
}
