'use strict';

const puppeteer = require('puppeteer');
const { ArgumentParser } = require('argparse');

const { XHRLogger } = require('./xhr-logger');
const { SettleTracker } = require('./settle-tracker');
const { getPossibleEvents } = require('./page-events');
const { log } = require('./logging');

const { waitWithCancel, wait } = require('./utils');

const LOADED_COOLDOWN = 250;

const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.54 Safari/537.36";

class Crawler {
    constructor(targetURL, headless=true) {
        // normalize
        const u = new URL(targetURL);
        u.hash = '';
        this.targetURL = u.href;
        this.xhrLogger = new XHRLogger(this.targetURL);

        this.abortNavigation = false;
        this.preventNewFrames = false;
        this.navigationWasAttempted = false;
        this.navigationTargets = new Set();
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

        await page.setUserAgent(USER_AGENT);

        this.settleTracker = new SettleTracker(page, LOADED_COOLDOWN);
    }

    /*async reload() {
        this.abortNavigation = false;
        await this.page.goto(this.pageURL, { waitUntil: 'networkidle0' });
        await this.settleTracker.waitToSettle()
    }*/

    async handleRequest(handler) {
        await this.pageIsCreated;
        this.page.on('request', handler);
        await this.page.setRequestInterception(true);
    }

    async handleResponse(handler) {
        await this.pageIsCreated;
        this.page.on('response', handler);
    }

    async loadPage() {
        await this.pageIsCreated;

        try {
            await this.page.goto(this.targetURL, {
                waitUntil: 'networkidle0',
                timeout: 3 * 60 * 1000,
            });
        } catch (err) {
            if (!(err instanceof puppeteer.errors.TimeoutError)) {
                throw(err);
            }
        }

        log('page load complete, networkidle0 arrived. Wait to settle');

        let {promise: timer, cancel} = waitWithCancel(3 * 60 * 1000);

        await Promise.race([this.settleTracker.waitToSettle(), timer]);

        cancel();
        this.settleTracker.stop();

        log('page load done');

        // may differ from this.targetURL due to redirects
        // for example, http -> https or site.com -> www.site.com
        this.pageURL = this.page.url();

        this.abortNavigation = true;
        this.preventNewFrames = true;
        this.navigationWasAttempted = false;
    }

    async performClick(elem, descr) {
        log('click', descr);
        try {
            await elem.click();
        } catch(err) {
            log('failed to click', descr, err);
            if (err.message === 'Node is detached from document') {
                log('Node detached from document, reload and retry');
                return true;
            }
            log('fall back to .click()');
            try {
                await this.page.evaluate(elem => elem.click(), elem);
            } catch(err) {
                log('failed to click using .click()', descr, err);
            }
        }
        return false;
    }

    async triggerEvents(events, alreadyDone) {
        for (const event of events) {
            const elem = event.element;
            const descr = elem._remoteObject.description;
            const eventTag = event.type + ' ' + descr;
            if (alreadyDone.has(eventTag)) {
                log(`skip event ${eventTag}: already done it`);
                continue;
            }
            alreadyDone.add(eventTag);
            if (event.type !== 'click') {
                log(`skip event of type ${event.type}, only clicks are supported for now`);
                continue;
            }

            const shouldReload = await this.performClick(elem, descr);

            if (shouldReload) {
                return [eventTag, false];
            }
            await wait(100);

            await this.settleTracker.waitToSettle();
            if (this.navigationWasAttempted) {
                log('navigation was triggred, maybe handle it somehow later');
            }
            log('clicked, proceed to next event');
        }
        return [null, true];
    }

    #setupCrawlEventHandler() {
        this.handleRequest(req => {
            // NOTE: we currently ignore requests from subframes
            if (req.frame() !== this.page.mainFrame()) {
                return;
            }
            this.xhrLogger.addRequest(req);

            if (this.abortNavigation && req.isNavigationRequest()) {
                this.navigationWasAttempted = true;
                this.navigationTargets.add(req.url());
                req.abort('aborted');
            } else {
                req.continue();
            }
        });
    }

    async crawl() {
        this.#setupCrawlEventHandler();

        let prevRetryEvent = null;
        const eventsAlreadyDone = new Set();

        while (true) {
            await this.loadPage();

            const events = await getPossibleEvents(this.page);
            const [retryEvent, allDone] = await this.triggerEvents(
                events,
                eventsAlreadyDone
            );
            if (allDone) {
                break;
            }
            if (prevRetryEvent !== null && retryEvent === prevRetryEvent) {
                log(`already retried ${retryEvent}, giving up on it`);
                prevRetryEvent = null;
            } else {
                eventsAlreadyDone.delete(retryEvent);
                prevRetryEvent = retryEvent;
            }
            this.abortNavigation = false;
        }
    }

    async close() {
        await this.browser.close();
    }
}

exports.Crawler = Crawler;
