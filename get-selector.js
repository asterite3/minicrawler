function getSelector(elem) {
    var selector = '',
        allSelectors = [],
        parentElement,
        tagName,
        index,
        classes;


    while (elem) {
        tagName = elem.tagName.toLowerCase();
        selector = tagName;

        if (elem === document.documentElement) {
            allSelectors.unshift(selector);
            break;
        }

        if (!elem.parentElement) {
            throw Error('getSelector called for element (' + elem + ') not connected to DOM tree');
        }

        parentElement = elem.parentElement;
        if (!elem.tagName) {
            if (!selector) {
                selector = '';
            }
            elem = parentElement;
            continue;
        }
        if (elem.id) {
            if (/^[a-zA-Z][a-zA-Z0-9\-_]+$/.test(elem.id)) {
                selector = selector + '#' + elem.id;
                allSelectors.unshift(selector);
                if (document.querySelectorAll(allSelectors.join(' > ')).length === 1) {
                    break;
                }
            }
        }


        classes = elem.getAttribute('class');
        if (classes) {
            classes = classes.split(/\s/ig).sort();
            classes = classes.filter(function (cls) {
                return /^[a-zA-Z][a-zA-Z0-9\-_]+$/.test(cls);
            });

            if (classes.length > 0) {
               selector += '.' + classes.join('.');
            }
        }

        if (parentElement.childElementCount > 1) {
            index = toArray(elem.parentNode.children).indexOf(elem) + 1;
            // index = elementIndex(elem) + 1;
            selector += ':nth-child(' + index + ')';
        }
        allSelectors.unshift(selector);
        elem = parentElement;
    }
    return allSelectors.join(' > ');
};