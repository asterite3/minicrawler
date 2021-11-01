const { ArgumentParser } = require('argparse');

const { Crawler } = require('..');

(async () => {
    const parser = new ArgumentParser();

    parser.add_argument('target_url');
    parser.add_argument('--no-headless', { action: 'store_true' });

    const args = parser.parse_args();

    const crawler = new Crawler(args.target_url, !args.no_headless);

    try {
        await crawler.crawl();
    } finally {
        await crawler.close();
    }

    console.log(JSON.stringify(crawler.xhrLogger.requests, null, 4));
})();
