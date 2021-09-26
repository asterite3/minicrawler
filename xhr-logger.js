const {
    filterByDomain,
    DomainFilteringMode
} = require('../js-analyzer/src/analyzer/domain-filtering');

const { harFromRequest } = require('./har');
const { log } = require('./logging');

class XHRLogger {
    constructor(baseURL) {
        this.requests = [];
        this.baseURL = baseURL;
    }

    addRequest(req) {
        const t = req.resourceType();

        if (t !== 'xhr' && t !== 'fetch') {
            return;
        }

        const url = req.url();

        if (!filterByDomain(url, this.baseURL, DomainFilteringMode.SecondLevel)) {
            return;
        }

        this.logToConsole(req);
        
        this.requests.push(harFromRequest(req));
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