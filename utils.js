const crypto = require('crypto');

function wait(d) {
    return new Promise(resolve => setTimeout(resolve, d));
}

function waitWithCancel(d) {
    let timeoutID;
    const timerFired = Symbol();
    const p = new Promise(resolve => {
        timeoutID = setTimeout(() => resolve(timerFired), d);
    });
    return {
        promise: p,
        cancel: () => clearTimeout(timeoutID),
        timerFiredSymbol: timerFired
    };
};

async function withTimeout(p, d) {
    let {promise: timer, cancel, timerFiredSymbol} = waitWithCancel(d);
    try {
        return await Promise.race([p, timer]) === timerFiredSymbol
    } finally {
        cancel();
    }
}

function getRandomString(byteLen=20) {
    return crypto.randomBytes(byteLen).toString('hex');
}

exports.wait = wait;
exports.waitWithCancel = waitWithCancel;
exports.withTimeout = withTimeout;
exports.getRandomString = getRandomString;
