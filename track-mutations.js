function trackMutations() {
    const timestampContainer = {
        lastDOMMutation: Date.now()
    };

    const observer = new MutationObserver(() => {
        timestampContainer.lastDOMMutation = Date.now();
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
        page.on('domcontentloaded', async () => {
            this.timestampContainer = await page.evaluateHandle(trackMutations);
            this.domContentLoaded = true;
        });
    }

    async mutationsSettled() {
        if (!this.domContentLoaded) {
            console.log('dom content not loaded yet');
            return false;
        }

        const lastMutation = await this.page.evaluate(
            getLastMutationTimestamp,
            this.timestampContainer
        );
        
        console.log('now ' + Date.now() + ' last mut ' + lastMutation )
        const sinceLastMutation = Date.now() - lastMutation;
        console.log('settled: ' + (sinceLastMutation > this.cooldown));

        return sinceLastMutation > this.cooldown;
    }
}

exports.PageMutationTracker = PageMutationTracker;