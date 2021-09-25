const urllib = require('url');

function getQueryNameValue(q) {
    const arr = q.split('=');
    const result = arr.slice(0, 1);

    result.push(arr.slice(1).join('='));
    return result;
}

function parseQueryString(har, parsedURL) {
    if (parsedURL.search) {
        for (let part of parsedURL.search.substring(1).split('&')) {
            let [name, value] = getQueryNameValue(part);
            har.queryString.push({
                name,
                value
            });
        }
    }
}

function parseMultipart(mptext, boundary) {
    const result = [];
    const parts = mptext.split('\r\n');
    const delim = '--' + boundary;
    const finalDelim = delim + '--';

    let index = 0,
        name;

    while (index < parts.length) {
        let part = parts[index];

        if (part === finalDelim) {
            return result;
        }

        if (part === delim) {
            index += 1;
            continue;
        }

        if (part.startsWith('Content-Disposition:')) {
            for (let field of part.split(' ')) {
                if (field.startsWith('name=')) {
                    name = field.split('="')[1].split('"')[0];
                }
            }
        }
        if (part === '') {
            // value follows
            let valueParts = [];
            index++;
            while (index < parts.length && parts[index] !== delim && parts[index] !== finalDelim) {
                valueParts.push(parts[index]);
                index++;
            }
            result.push({
                name,
                value: valueParts.join('\r\n')
            });
            name = undefined;
        } else {
            index++;
        }
    }
    throw new Error('Should not get here - probably bad multipart: boundary ' + boundary + ' ' + mptext);
}

function hasHeader(headers, name) {
    return headers.hasOwnProperty(name);
}

function getHeader(headers, name) {
    return headers[name];
}

function setPostData(har, headers, postData) {
    har.postData = {
        "text": postData
    }
    har.bodySize = postData.length;
    har.headers.push({
        'name': 'Content-Length',
        'value': postData.length + ''
    });
    let ct, ctParts, ctType;
    if (hasHeader(headers, 'content-type')) {
        ct = getHeader(headers, 'content-type');
        har.headers.push({
            'name': 'Content-Type',
            'value': ct
        });
        har.postData.mimeType = ct;
        ctParts = ct.split('; ');
        ctType = ctParts[0];
    }
    if (ctType === 'application/x-www-form-urlencoded') {
        har.postData.params = [];
        for (let part of postData.split('&')) {
            let [name, value] = getQueryNameValue(part);
            har.postData.params.push({
                name,
                value
            });
        }
    } else if (ctType === 'multipart/form-data') {
        let boundary = ctParts[1].split('=')[1];
        har.postData.params = parseMultipart(postData, boundary);
    }
}

exports.harFromRequest = function(request) {
    const url = request.url();
    const parsedURL = new urllib.URL(url);
    const postData = request.postData();
    const har = {
        "method": request.method(),
        "url": url,
        "httpVersion": "HTTP/1.1",
        "headers": [{
            "name": "Host",
            "value": parsedURL.host
        }],
        "queryString": [],
        "bodySize": 0
    };

    parseQueryString(har, parsedURL);
    const headers = request.headers();

    if (typeof postData !== 'undefined') {
        setPostData(har, headers, postData);
    }
    
    return har;
}