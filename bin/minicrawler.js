#!/usr/bin/env node

const { ArgumentParser } = require('argparse');

const { Crawler } = require('..');
const { log } = require('../logging');

(async () => {
    const parser = new ArgumentParser();

    parser.add_argument('target_url');
    parser.add_argument('--no-headless', { action: 'store_true' });
    parser.add_argument('--proxy', { type: String });
    parser.add_argument('-H', '--headers', { action: 'append', nargs: '+', default: [] })

    const args = parser.parse_args();
    
    let reqExtraHeaders = {};

    for (const s of args.headers) {
        if (!s[0].includes(': ')) {
            console.warn(`Warning: wrong header format, ignoring: "${s}"`);
            continue;
        }
        const name = s[0].split(': ')[0];
        const value = s[0].split(': ').slice(1)[0];
        reqExtraHeaders[name] = value;
    }

    const crawler = new Crawler(
        args.target_url,
        !args.no_headless,
        reqExtraHeaders,
        args.proxy
    );

    try {
        log(`start crawling ${args.target_url}`);
        await crawler.crawl();
        log(`completed crawling ${args.target_url}`);
    } finally {
        log(`crawling process of ${args.target_url} ended, closing and exiting`);
        await crawler.close();
        console.log(JSON.stringify(crawler.xhrLogger.requests, null, 4));
    }
})();
