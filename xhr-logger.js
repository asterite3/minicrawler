const { harFromRequest } = require('./har');
const { log } = require('./logging');

class XHRLogger {
    constructor(baseURL) {
        this.requests = [];
        this.baseURL = baseURL;
        this.interactionsStarted = false;
    }

    addRequest(req) {
        const t = req.resourceType();

        if (t !== 'xhr' && t !== 'fetch') {
            return;
        }

        const url = req.url();

        this.logToConsole(req);

        const har = harFromRequest(req);
        har.initiator = req.initiator();
        har.initiator.wasDuringInteraction = this.interactionsStarted;
        
        this.requests.push(har);
    }

    logToConsole(req) {
        const postData = req.postData();
        let printedPostData = '';

        if (typeof postData !== 'undefined') {
            printedPostData = ' ' + postData.substring(0, 100);
        }

        log(`${req.method()} ${req.url()} ${printedPostData}`);
    }
}

exports.XHRLogger = XHRLogger;
