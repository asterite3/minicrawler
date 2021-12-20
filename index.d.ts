import type * as puppeteer from 'puppeteer';

interface CrawlerOptions {
    logXHR?: boolean;
    waitMode?: string;
    loadedCooldown?: number;
    executablePath?: string | null;
    timeout?: number;
}

export declare class Crawler {
    page: puppeteer.Page | null;
    pageIsCreated: Promise<void>;

    constructor(
        url: string,
        headless?: boolean,
        reqExtraHeaders?: Record<string, string>,
        proxy?: string,
        options?: CrawlerOptions
    );
    loadPage(timeout?: number): Promise<puppeteer.HTTPResponse>;
    handleRequest(cb: (req: puppeteer.HTTPRequest) => void): Promise<void>;
    close(): Promise<void>;
}
