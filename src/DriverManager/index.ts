import { initDriver, LaunchOptions, DriverType, PageType, Utils } from './Puppeteer';
import moment from 'moment';
import path from 'path';

export interface DriverOptions extends LaunchOptions {
    outputDir?: string,
    blockImages?: boolean,
    hangOnFail?: boolean,
    saveOnFail?: boolean,
}

class DriverBase {
    protected config = {
        outputDir: path.join(process.cwd(), './results'),
        blockImages: true,
        hangOnFail: false,
        saveOnFail: true,
    }

    protected constructor(protected driver: DriverType, protected page: PageType, options?: DriverOptions) {
        this.config = { ...this.config, ...options };
    }

    private async saveState() {
        let savePath = 'not saved';
        let screenshotPath = 'not saved';
        if (this.config.saveOnFail) {
            try {
                savePath = await Utils.savePageContents(this.page, this.config.outputDir);
            } catch (err) {
                savePath = 'error saving';
            }
            try {
                screenshotPath = await Utils.saveScreenshot(this.page, this.config.outputDir);
            } catch (err) {
                screenshotPath = 'error saving';
            }
        }
        return { savePath, screenshotPath };
    }

    protected async handleFail(error: any, actionType: string, args?: object) {
        let saveMessage = await this.saveState();
        let message = `
        >>>Exception thrown in "${actionType}"
        >>>Args: ${JSON.stringify(args)}
        >>>Message: ${error.message || error}
        >>>Saved screenshot to: ${saveMessage.screenshotPath}
        >>>Saved context to: ${saveMessage.savePath}
        >>>Closing driver...
        `
        console.error(message);
        if (this.config.hangOnFail) {
            // Wait forever and catch keyboard interrupt.
            try {
                await this.page.waitFor(2147483647)
            } catch (err) { console.log('resuming') }
        }
        await this.driver.close();
    }
}

export type DriverAction = (page: PageType, ...args: any) => Promise<any>;
interface DriverActionPackage {
    action: DriverAction,
    args?: any,
    name: string,
    next: DriverActionPackage | null
}

class DriverActionChain extends DriverBase {
    protected actionChainHead: DriverActionPackage | null = null;
    protected actionChainTail: DriverActionPackage | null = null;

    constructor(protected driver: DriverType, protected page: PageType, options?: DriverOptions) {
        super(driver, page);
    }

    protected addDriverAction(actionName: string, action: DriverAction, ...actionArgs: any) {
        let newActionPackage: DriverActionPackage = {
            action: action,
            name: actionName,
            args: actionArgs,
            next: null
        }
        if (!this.actionChainHead) {
            this.actionChainHead = newActionPackage;
            this.actionChainTail = newActionPackage;
        } else {
            this.actionChainTail!.next = newActionPackage;
            this.actionChainTail = newActionPackage;
        }
    }

    private _clearActionChain(current: DriverActionPackage | null) {
        if (!current) {
            return
        }
        this._clearActionChain(current.next);
        current.next = null;
        return;
    }

    private clearActionChain() {
        this._clearActionChain(this.actionChainHead);
        this.actionChainHead = null;
        this.actionChainTail = null;
    }

    private async _perform(actionPackage: DriverActionPackage | null, lastResult?: any): Promise<any> {
        if (!actionPackage) {
            return lastResult;
        }
        try {
            let res = await actionPackage.action(this.page, ...actionPackage.args);
            return await this._perform(actionPackage.next, res);
        } catch (err) {
            await this.handleFail(err, actionPackage.name, actionPackage.args);
            return;
        }
    }

    public async perform(): Promise<any> {
        let res = await this._perform(this.actionChainHead);
        this.clearActionChain();
        return res;
    }
}

export default class Driver extends DriverActionChain {

    /**
     * 
     * @param opts Launch options used to create the driver
     */
    public static async initialize(opts?: DriverOptions): Promise<Driver> {
        let driver = await initDriver(opts);
        return new Driver(driver, (await driver.pages())[0], opts);
    }

    public screenshot() {
        this.addDriverAction('screenshot', async page => {
            await Utils.saveScreenshot(page, this.config.outputDir);
        });
        return this;
    }

    public goto(url: string) {
        this.addDriverAction('goto', async page => {
            await page.goto(url);
        }, url);
        return this;
    }

    public click(selector: string, opts?: { timeout?: number }) {
        this.addDriverAction('click', async page => {
            if (opts?.timeout) {
                await page.waitForSelector(selector);
            }
            await page.click(selector);
        }, selector, opts);
        return this;
    }

    public close() {
        this.addDriverAction('close', async page => {
            await page.browser().close();
        });
        return this;
    }
}
