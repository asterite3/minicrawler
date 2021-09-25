const { PageMutationTracker } = require('./track-mutations');
const { wait } = require('./utils');

class SettleTracker {
    constructor(page, cooldown) {
        this.cooldown = cooldown;
        this.mutationTracker = new PageMutationTracker(page, cooldown);
        this.pendingRequestCount = 0;

        this.notifyRequestsAreDone = null;

        page.on('request', this.handleRequestStarted.bind(this));
        page.on('requestfinished', this.handleRequestEnded.bind(this));
        page.on('requestfailed', this.handleRequestEnded.bind(this));
    }

    handleRequestStarted() {
        this.pendingRequestCount++;
    }

    handleRequestEnded() {
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
        while (true) {
            if (this.pendingRequestCount > 0) {
                await this.waitForRequests();
            }
            const mutationsSettled = await this.mutationTracker.mutationsSettled();
            if (!mutationsSettled) {
                await wait(this.cooldown);
                continue;
            }
            return;
        }
    }
}

exports.SettleTracker = SettleTracker;