const { ArgumentParser } = require('argparse');

const { Crawler } = require('..');
const { log } = require('../logging');

(async () => {
    const parser = new ArgumentParser();

    parser.add_argument('target_url');
    parser.add_argument('--no-headless', { action: 'store_true' });
    parser.add_argument('--proxy', { type: String });

    const args = parser.parse_args();

    const crawler = new Crawler(args.target_url, !args.no_headless, args.proxy);

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
