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
        this.preventNewFrames = false;
        this.pageURL = null; // current URL, will be set after URL is opened

        this.headless = headless;

        this.pageIsCreated = this.createPage();
    }

    async createPage() {
        const options = {
            executablePath: 'google-chrome',
            headless: this.headless,
            ignoreHTTPSErrors: true
        };
        if (!this.headless) {
            options.defaultViewport = null;
        }
        const browser = await puppeteer.launch(options);
        this.browser = browser;

        browser.on('targetcreated', async target => {
            if (this.preventNewFrames && target.type() === 'page') {
                const page = await target.page();
                await page.close();
            }
        })

        const page = await browser.newPage();
        this.page = page;

        page.on('request', req => {
            // NOTE: we currently ignore requests from subframes
            if (req.frame() !== page.mainFrame()) {
                return;
            }
            this.xhrLogger.addRequest(req);

            if (this.abortNavigation && req.isNavigationRequest()) {
                req.abort('aborted');
            } else {
                req.continue();
            }
        });

        await page.setRequestInterception(true);
        await page.setUserAgent(USER_AGENT);

        this.settleTracker = new SettleTracker(page, LOADED_COOLDOWN);
    }

    /*async reload() {
        this.abortNavigation = false;
        await this.page.goto(this.pageURL, { waitUntil: 'networkidle0' });
        await this.settleTracker.waitToSettle()
    }*/

    async _run() {
        await this.page.goto(this.targetURL, { waitUntil: 'networkidle0' });

        log('page load complete, networkidle0 arrived. Wait to settle');

        await this.settleTracker.waitToSettle();

        log('page load done');

        // may differ from this.targetURL due to redirects
        // for example, http -> https or site.com -> www.site.com
        this.pageURL = this.page.url();

        this.abortNavigation = true;
        this.preventNewFrames = true;

        const events = await getPossibleEvents(this.page);

        for (const event of events) {
            if (event.type !== 'click') {
                log(`skip event of type ${event.type}, only clicks are supported for now`);
                continue;
            }

            const elem = event.element;
            const descr = elem._remoteObject.description;
            log('click', descr);
            try {
                await elem.click();
            } catch(err) {
                log('failed to click', descr, err);
                console.log(err.message);
                log('fall back to .click()');
                try {
                    await this.page.evaluate(elem => elem.click(), elem);
                } catch(err) {
                    log('failed to click using .click()', descr, err);
                }
            }
            await this.settleTracker.waitToSettle();
            log('clicked, proceed to next event');
        }
    }

    async run() {
        try {
            await this.pageIsCreated;

            await this._run();
        } finally {
            await this.browser.close();
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

    console.log(JSON.stringify(crawler.xhrLogger.requests, null, 4));
})();