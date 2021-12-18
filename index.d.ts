import type * as puppeteer from 'puppeteer';

export declare class Crawler {
    page: puppeteer.Page | null;
    pageIsCreated: Promise<void>;

    constructor(url: string);
    loadPage(timeout?: number): Promise<puppeteer.HTTPResponse>;
    close(): Promise<void>;
}
