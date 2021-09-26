const pad = s => String(s).padStart(2, '0');
const padYear = s => String(s).padStart(4, '0');
const padMsec = s => String(s).padEnd(3, '0');

function formatDate() {
    const d = new Date();
    const dateString = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}` +
        `.${d.getFullYear()}`;

    const timeString = `${pad(d.getHours())}:${pad(d.getMinutes())}:` +
        `${pad(d.getSeconds())}.${padMsec(d.getMilliseconds())}`;

    return `${dateString} ${timeString}`;
}

function log(...args) {
    console.error(formatDate(), ...args);
};

exports.log = log;