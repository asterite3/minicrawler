const { ElementHandle } = require('puppeteer-core/internal/common/ElementHandle.js');

const { getSelector } = require('./get-selector');
const { shuffleArray } = require('./utils');
const { log } = require('./logging');

const OBJECT_GROUP_NAME = 'event-listeners-group';

async function getPossibleEvents(page) {
    /*
        click
        input/fill
        submit
        mouseover
        scroll
    */

    const clickEvents = (await page.$$('a, button')).map(el => ({
        type: 'click',
        element: el
    }));
    const inputEvents = (await page.$$('input, textarea, select')).map(el => ({
        type: 'input',
        element: el
    }));
    const submitEvents = (await page.$$('form')).map(el => ({
        type: 'submit',
        element: el
    }));

    const client = page._client();

    const { result: html } = await client.send('Runtime.evaluate', {
        expression: 'document.documentElement',
        objectGroup: OBJECT_GROUP_NAME
    });

    const eventListeners = await client.send(
        'DOMDebugger.getEventListeners',
        {
            objectId: html.objectId,
            depth: -1
        }
    );

    const frame = page.mainFrame();
    const executionContext = await frame.executionContext();

    const jsEvents = await Promise.all(eventListeners.listeners.map(async listener => {
        const nodeRemoteObject = await client.send('DOM.resolveNode', {
            backendNodeId: listener.backendNodeId,
            objectGroup: OBJECT_GROUP_NAME,
        });
        const e = new ElementHandle(
                executionContext,
                nodeRemoteObject.object,
                frame
            );
        return {
            type: listener.type,
            element: e
        };
    }));
    const events = jsEvents.concat(
        inputEvents,
        submitEvents,
        shuffleArray(clickEvents)
    );
    for (const evt of events) {
        const elem = evt.element;
        let descr = elem.remoteObject().description;
        const selectorIsGood = await page.evaluate(
            (sel, el) => {
                try {
                    let elems = document.querySelectorAll(sel);
                    return elems.length === 1 && elems[0] === el;
                } catch (err) {
                    return false;
                }
            },
            descr,
            elem
        );

        if (!selectorIsGood) {
            const oldDescr = descr;
            descr = await page.evaluate(getSelector, elem, false);
            //log(`generated more accurate selector ${descr} instead of ${oldDescr}`);
        }
        evt.selector = descr;
    }
    return events.filter(evt => evt.selector !== null);
};

exports.getPossibleEvents = getPossibleEvents;
