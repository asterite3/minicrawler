const { ElementHandle } = require('puppeteer/lib/JSHandle');

const OBJECT_GROUP_NAME = 'event-listeners-group';

async function getPossibleEvents(page) {
    /*
        click
        fill
        submit
        mouseover
    */

    const { result: html } = await page._client.send('Runtime.evaluate', {
        expression: 'document.documentElement',
        objectGroup: OBJECT_GROUP_NAME
    });

    const eventListeners = await page._client.send(
        'DOMDebugger.getEventListeners',
        {
            objectId: html.objectId,
            depth: -1
        }
    );

    const executionContext = await page.mainFrame().executionContext();

    return await Promise.all(eventListeners.listeners.map(async listener => {
        const nodeRemoteObject = await page._client.send('DOM.resolveNode', {
            backendNodeId: listener.backendNodeId,
            objectGroup: OBJECT_GROUP_NAME,
        });
        return {
            type: listener.type,
            element: new ElementHandle(
                executionContext,
                page._client,
                nodeRemoteObject.object,
                page,
                page._frameManager
            )
        };
    }));
};

exports.getPossibleEvents = getPossibleEvents;