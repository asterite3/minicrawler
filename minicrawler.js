'use strict';

const puppeteer = require('puppeteer');
const { ArgumentParser } = require('argparse');

const { XHRLogger } = require('./xhr-logger');
const { SettleTracker } = require('./settle-tracker');
const { getPossibleEvents } = require('./page-events');
const { getSelector } = require('./get-selector');
const { log } = require('./logging');

const { withTimeout, wait } = require('./utils');

const LOADED_COOLDOWN = 250;
const PAGE_LOAD_TIMEOUT = 3 * 60 * 1000;
const MAX_TIMEOUT_COUNT = 2;

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
        this.timeout = PAGE_LOAD_TIMEOUT;
        this.timeoutCount = 0;
    }

    async withTimeout(p) {
        return await withTimeout(p, this.timeout);
    }

    async waitToSettle() {
        const timedOut = await this.withTimeout(this.settleTracker.waitToSettle());

        if (timedOut) {
            if (this.timeoutCount < MAX_TIMEOUT_COUNT) {
                log(`waiting for event timed out, timeout was ${this.timeout}`);
            }
            this.timeoutCount++;
            if (this.timeoutCount === MAX_TIMEOUT_COUNT) {
                log(`timed out too many times, lowering timeout`);
                this.timeout = 1000;
            }
        }

        return timedOut;
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

    async loadPage(timeout=PAGE_LOAD_TIMEOUT) {
        await this.pageIsCreated;

        try {
            await this.page.goto(this.targetURL, {
                waitUntil: 'networkidle0',
                timeout: timeout,
            });
        } catch (err) {
            if (!(err instanceof puppeteer.errors.TimeoutError)) {
                throw(err);
            } else {
                log(`warning: page.goto timed out (with networkidle0)`)
            }
        }

        log('page load complete, networkidle0 arrived. Wait to settle');

        await this.waitToSettle();

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
            let descr = elem._remoteObject.description;

            if (!await this.page.evaluate(el => el.isConnected, elem)) {
                log(`Node ${descr} detached from document, reload and retry`);
                return [null, false];
            }

            const [selectorIsGood, elemCount] = await this.page.evaluate(
                (sel, el) =>  {
                    let elems = document.querySelectorAll(sel);
                    return [elems.length === 1 && elems[0] === el, elems.length]
                },
                descr,
                elem
            );

            if (!selectorIsGood) {
                const oldDescr = descr;
                descr = await this.page.evaluate(getSelector, elem);
                log(`generated more accurate selector ${descr} instead of ${oldDescr}`);
            }
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
            await wait(150);

            this.timeout = Math.min(this.timeout, 20 * 1000);
            await this.waitToSettle();
            this.settleTracker.stop();
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

    async #checkWindowScrollable() {
        return await this.page.evaluate(() => {
            for (const el of [document.documentElement, document.body]) {
                if (el.scrollHeight > el.clientHeight) {
                    return true;
                }
            }
            return false;
        });
    }

    async #scrollToBottom() {
        let originalOffset = 0;
        while (true) {
            // TODO: use this.page.mouse.wheel after upgrading puppeteer
            //const scrollHeight = await this.page.evaluate('document.body.scrollHeight');
            /*await this.page.mouse.wheel({
                deltaY: scrollHeight
            })*/
            await this.page.evaluate('window.scrollBy(0, document.body.scrollHeight)');
            await this.waitToSettle();
            this.settleTracker.stop();
            const newOffset = await this.page.evaluate('window.pageYOffset');
            if (originalOffset === newOffset) {
                break;
            }
            originalOffset = newOffset;
        }
    }

    async crawl() {
        this.#setupCrawlEventHandler();

        let prevRetryEvent = null;
        let shouldScroll = false;
        const eventsAlreadyDone = new Set();

        let timeout = PAGE_LOAD_TIMEOUT;

        while (true) {
            await this.loadPage(timeout);

            const events = await getPossibleEvents(this.page);

            events.filter(evt => {
                if (evt.type === 'scroll') {
                    shouldScroll = true;
                    return false;
                }
            })

            const [retryEvent, allDone] = await this.triggerEvents(
                events,
                eventsAlreadyDone
            );
            if (allDone) {
                break;
            }
            if (retryEvent !== null) {
                if (prevRetryEvent !== null && retryEvent === prevRetryEvent) {
                    log(`already retried ${retryEvent}, giving up on it`);
                    prevRetryEvent = null;
                } else {
                    eventsAlreadyDone.delete(retryEvent);
                    prevRetryEvent = retryEvent;
                }
            }
            timeout = 30 * 1000;
            this.abortNavigation = false;
        }

        this.abortNavigation = false;
        await this.loadPage(timeout);

        if (!shouldScroll) {
            shouldScroll = await this.#checkWindowScrollable();
            if (shouldScroll) {
                log('should scroll because there are scrollbars');
            } else {
                log('should not scroll');
            }
        } else {
            log('should scroll because there are scroll event handlers');
        }

        if (shouldScroll) {
            await this.#scrollToBottom();
            await this.waitToSettle();
            this.settleTracker.stop();
        }
    }

    async close() {
        await this.browser.close();
    }
}

exports.Crawler = Crawler;
