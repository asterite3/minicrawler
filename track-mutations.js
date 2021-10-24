const crypto = require('crypto');

function trackMutations(datenowName) {
    const timestampContainer = {
        lastDOMMutation: window[Symbol.for(datenowName)]()
    };

    const observer = new MutationObserver(() => {
        timestampContainer.lastDOMMutation = window[Symbol.for(datenowName)]();
    });

    observer.observe(document.documentElement, {
        attributes: true,
        childList: true,
        subtree: true,
        characterData: true
    });

    return timestampContainer;
}

function getLastMutationTimestamp(timestampContainer) {
    return timestampContainer.lastDOMMutation;
}

class PageMutationTracker {
    constructor(page, cooldown) {
        this.page = page;
        this.cooldown = cooldown;
        this.domContentLoaded = false;

        let datenowName = crypto.randomBytes(20).toString('hex');

        this.ready = page.evaluateOnNewDocument(datenowName => {
            window[Symbol.for(datenowName)] = Date.now;
        }, datenowName);

        page.on('domcontentloaded', async () => {
            await this.ready;
            this.timestampContainer = await page.evaluateHandle(trackMutations, datenowName);
            this.domContentLoaded = true;
        });
    }

    async mutationsSettled() {
        if (!this.domContentLoaded) {
            //console.log('dom content not loaded yet');
            return false;
        }

        const lastMutation = await this.page.evaluate(
            getLastMutationTimestamp,
            this.timestampContainer
        );
        
        //console.log('now ' + Date.now() + ' last mut ' + lastMutation )
        const sinceLastMutation = Date.now() - lastMutation;
        //console.log('settled: ' + (sinceLastMutation > this.cooldown));

        return sinceLastMutation > this.cooldown;
    }
}

exports.PageMutationTracker = PageMutationTracker;
