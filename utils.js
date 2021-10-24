function wait(d) {
    return new Promise(resolve => setTimeout(resolve, d));
}

function waitWithCancel(d) {
    let timeoutID;
    const p = new Promise(resolve => {
        timeoutID = setTimeout(resolve, d);
    });
    return {
        promise: p,
        cancel: () => clearTimeout(timeoutID),
    };
};

exports.wait = wait;
exports.waitWithCancel = waitWithCancel;
