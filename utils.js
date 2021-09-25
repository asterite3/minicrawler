function wait(d) {
    return new Promise(resolve => setTimeout(resolve, d));
}

exports.wait = wait;