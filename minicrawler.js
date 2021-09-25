'use strict';

const puppeteer = require('puppeteer');

const { XHRLogger } = require('./xhr-logger');
const { SettleTracker } = require('./settle-tracker');

const LOADED_COOLDOWN = 250;

const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.54 Safari/537.36";

class Crawler {
    constructor(targetURL) {
        // normalize
        this.targetURL = new URL(targetURL).href;
        this.xhrLogger = new XHRLogger(this.targetURL);

        this.pageIsCreated = this.createPage();
        this.abortNavigation = false;
        this.pageURL = null; // current URL, will be set after URL is opened
    }

    async createPage() {
        const browser = await puppeteer.launch({
            executablePath: 'google-chrome'
        });
        this.browser = browser;

        const page = await browser.newPage();
        this.page = page;

        page.on('request', req => {
            this.xhrLogger.addRequest(req);

            if (
                this.abortNavigation &&
                req.isNavigationRequest() &&
                req.frame() === page.mainFrame() &&
                req.url() !== this.pageURL
            ) {
                console.log(`"${url}" not equal to "${targetURL}", so abort nav`);
                req.abort('aborted');
            } else {
                req.continue();
            }
        });

        await page.setRequestInterception(true);
        await page.setUserAgent(USER_AGENT);

        this.settleTracker = new SettleTracker(page, LOADED_COOLDOWN);
    }

    async run() {
        await this.pageIsCreated;
        await this.page.goto(this.targetURL, { waitUntil: 'networkidle0' });

        // may differ from this.targetURL due to redirects
        // for example, http -> https or site.com -> www.site.com
        this.pageURL = this.page.url();

        await this.settleTracker.waitToSettle();

        //await this.page.screenshot({ path: '/tmp/screenshot.png' });
    }
}



(async () => {
    if (process.argv.length < 3) {
        console.log('need url arg');
        process.exit(1);
    }

    const crawler = new Crawler(process.argv[2]);

    
    await crawler.run();
    
    console.log('load done');

    await crawler.browser.close();

    console.log(JSON.stringify(crawler.xhrLogger.requests, null, 4));
})();