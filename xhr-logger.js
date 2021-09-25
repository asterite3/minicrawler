const {
    filterByDomain,
    DomainFilteringMode
} = require('../js-analyzer/src/analyzer/domain-filtering');

const { harFromRequest } = require('./har');

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

        const postData = req.postData();
        console.log(
            req.method() + ' ' + req.url() +
            (typeof postData !== 'undefined' ? ' ' + postData : '')
        );
        this.requests.push(harFromRequest(req));
    }
}

exports.XHRLogger = XHRLogger;