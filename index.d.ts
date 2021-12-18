import type * as puppeteer from 'puppeteer';

export declare class Crawler {
    page: puppeteer.Page | null;
    pageIsCreated: Promise<void>;

    constructor(
        url: string,
        headless?: boolean,
        reqExtraHeaders?: Record<string, string>,
        proxy?: string,
        options?: object
    );
    loadPage(timeout?: number): Promise<puppeteer.HTTPResponse>;
    close(): Promise<void>;
}
