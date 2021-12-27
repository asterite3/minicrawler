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

function shuffleArray(array) {
  let currentIndex = array.length,  randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex != 0) {

    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

function parseProxy(proxy) {
    const parsedProxy = new URL(proxy);
    if (parsedProxy.username === "" && parsedProxy.password === "") {
        return { addr: `${parsedProxy.protocol}//${parsedProxy.host}` };
    }
    return {
        addr: `${parsedProxy.protocol}//${parsedProxy.host}`,
        username: parsedProxy.username,
        password: parsedProxy.password,
    };
}

exports.wait = wait;
exports.waitWithCancel = waitWithCancel;
exports.withTimeout = withTimeout;
exports.getRandomString = getRandomString;
exports.shuffleArray = shuffleArray;
exports.parseProxy = parseProxy;
