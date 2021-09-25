'use strict';

const puppeteer = require('puppeteer');

const { XHRLogger } = require('./xhr-logger');

class Crawler {
    constructor(targetURL) {
        // normalize
        this.targetURL = new URL(targetURL).href;
        this.xhrLogger = new XHRLogger(this.targetURL);

        this.pageIsCreated = this.createPage();
        this.abortNavigation = false;
    }

    async createPage() {
        const browser = await puppeteer.launch({
            executablePath: 'google-chrome',
            headless: false
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
                req.url() !== this.targetURL
            ) {
                console.log(`"${url}" not equal to "${targetURL}", so abort nav`);
                req.abort('aborted');
            } else {
                req.continue();
            }
        });

        await page.setRequestInterception(true);
    }

    async run() {
        await this.pageIsCreated;
        await this.page.goto(this.targetURL, { waitUntil: 'networkidle0' });

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

    //await browser.close();

    console.log(JSON.stringify(crawler.xhrLogger.requests, null, 4));
})();