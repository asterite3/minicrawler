function formatDate() {
    const pad = s => String(s).padStart(2, '0');
    const d = new Date();
    const dateString = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}` +
        `.${d.getFullYear()}`;
    const timeString = `${pad(d.getHours())}:${pad(d.getMinutes())}:` +
        `${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
    return `${dateString} ${timeString}`;
}

module.exports.log = function log(msg) {
    console.error(`${formatDate()} ${msg}`);
}
