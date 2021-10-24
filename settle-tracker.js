const { PageMutationTracker } = require('./track-mutations');
const { wait } = require('./utils');

class SettleTracker {
    constructor(page, cooldown) {
        this.cooldown = cooldown;
        this.page = page;

        this.initPageMutationTracker()

        this.pendingRequestCount = 0;
        this.notifyRequestsAreDone = null;

        page.on('request', this.handleRequestStarted.bind(this));
        page.on('requestfinished', this.handleRequestEnded.bind(this));
        page.on('requestfailed', this.handleRequestEnded.bind(this));

        this.stopped = false;
        // this.pendingRequests = Object.create(null);
    }

    initPageMutationTracker() {
        this.frame = this.page.mainFrame();
        this.mutationTracker = new PageMutationTracker(this.page, this.cooldown);
    }

    handleRequestStarted(req) {
        // NOTE: we currently ignore requests from subframes
        if (req.frame() !== this.frame) {
            return;
        }
        this.pendingRequestCount++;
    }

    handleRequestEnded(req) {
        // NOTE: we currently ignore requests from subframes
        if (req.frame() !== this.frame) {
            return;
        }
        this.pendingRequestCount--;
        if (this.pendingRequestCount === 0 && this.notifyRequestsAreDone !== null) {
            this.notifyRequestsAreDone();
            this.notifyRequestsAreDone = null;
        }
    }

    waitForRequests() {
        return new Promise(resolve => {this.notifyRequestsAreDone = resolve});
    }

    async waitToSettle() {
        while (!this.stopped) {
            if (this.pendingRequestCount > 0) {
                //console.log('there are still ' + this.pendingRequestCount + ' pending requests, wait for them');
                await this.waitForRequests();
                await wait(100);
                continue;
            }
            const mutationsSettled = await this.mutationTracker.mutationsSettled();
            if (!mutationsSettled) {
                await wait(this.cooldown);
                continue;
            }
            return;
        }
    }

    stop() {
        this.stopped = true;
    }
}

exports.SettleTracker = SettleTracker;
