'use strict';

const puppeteer = require('puppeteer');
const { ArgumentParser } = require('argparse');

const { XHRLogger } = require('./xhr-logger');
const { SettleTracker } = require('./settle-tracker');
const { getPossibleEvents } = require('./page-events');
const { log } = require('./logging');

const LOADED_COOLDOWN = 250;

const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.54 Safari/537.36";

class Crawler {
    constructor(targetURL, headless=true) {
        // normalize
        this.targetURL = new URL(targetURL).href;
        this.xhrLogger = new XHRLogger(this.targetURL);

        this.abortNavigation = false;
        this.pageURL = null; // current URL, will be set after URL is opened

        this.headless = headless;

        this.pageIsCreated = this.createPage();
    }

    async createPage() {
        const browser = await puppeteer.launch({
            executablePath: 'google-chrome',
            headless: this.headless
        });
        this.browser = browser;

        const page = await browser.newPage();
        this.page = page;

        page.on('request', req => {
            this.xhrLogger.addRequest(req);

            if (
                this.abortNavigation &&
                req.isNavigationRequest() &&
                req.frame() === page.mainFrame()
            ) {
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

        await this.settleTracker.waitToSettle();

        log('page load done');

        // may differ from this.targetURL due to redirects
        // for example, http -> https or site.com -> www.site.com
        this.pageURL = this.page.url();

        this.abortNavigation = true;
        //await this.page.screenshot({path: '/tmp/screenshot.png'});
        
        const events = await getPossibleEvents(this.page);

        for (const event of events) {
            if (event.type !== 'click') {
                log(`skip event of type ${event.type}, only clicks are supported for now`);
                continue;
            }

            const elem = event.element;
            log('click', elem._remoteObject.description);            
            await elem.click();
            await this.settleTracker.waitToSettle();
            log('clicked, proceed to next event');
        }
    }
}



(async () => {
    const parser = new ArgumentParser();

    parser.add_argument('target_url');
    parser.add_argument('--no-headless', { action: 'store_true' });

    const args = parser.parse_args();


    const crawler = new Crawler(args.target_url, !args.no_headless);
    
    await crawler.run();

    await crawler.browser.close();

    console.log(JSON.stringify(crawler.xhrLogger.requests, null, 4));
})();