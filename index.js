'use strict';

// 3rd
const Nightmare = require('nightmare');
const nightmare = Nightmare({
    show: true, webPreferences: {
        webSecurity:false
    }
});
const urlHelper = require('url');

// const
const passed = {};
const fakeNewsSites = [ 'http://occupydemocrats.com' ];
const queue = fakeNewsSites.map(url => { return { url, path: [] }; });
const AD_INDICATORS = ['ads by', 'advertisement'];

function domainFilter(url) {
    const baseUrlParts = urlHelper.parse(options.url);
    const currentUrlParts = urlHelper.parse(url);
    return baseUrlParts.host === currentUrlParts.host;
}

function urlFilter(url) {
    if (options.urlFilter) {
        return options.urlFilter(url, domainFilter(url));
    }
    return domainFilter(url);
}


const processNextInQueue = () => {
    if (!queue.length) {
        nightmare.then(); // ensure nightmare acts on last action in `after`, if any
        return;
    }

    const { url, path } = queue.shift();
    const hostname = urlHelper.parse(url).hostname;

    if (!url || passed[url]) {
        return;
    }

    passed[url] = true;

    nightmare
        .goto(url)
        .wait(1000)
        .evaluate((AD_INDICATORS, hostname) => {
            function findElsWithText(textOptions) {
                let elements = [].concat(Array.from(document.body.children));
                const foundElements = [];

                while (elements.length > 0) {
                    const currentElement = elements.shift();
                    const containsText = textOptions.reduce((textFound, searchText) => {
                        if (textFound) return true;
                        return textFound || currentElement.innerHTML.toLowerCase().includes(searchText);
                    }, false);

                    if (containsText) {
                        if (currentElement.children.length === 0) {
                            foundElements.push(currentElement);
                        } else {
                            elements = elements.concat(Array.from(currentElement.children));
                        }
                    }
                }

                return foundElements;
            }

            function findLinksOfParentWithMoreThanOneLink(el) {
                let currentParent = el;
                let currentAnchors = currentParent.getElementsByTagName('a');

                while (currentAnchors.length <= 1) {
                    currentParent = currentParent.parentElement;
                    currentAnchors = currentParent.getElementsByTagName('a');
                }

                return Array.from(currentAnchors);
            }
            const adUrls = findElsWithText(AD_INDICATORS).reduce((adAnchors, currentAdEl) => {
                const newAdAnchors = findLinksOfParentWithMoreThanOneLink(currentAdEl)
                    .filter(anchor => anchor.hostname !== hostname)
                    .map(anchor => anchor.href);
                return adAnchors.concat(newAdAnchors);
            }, []);

            const siteUrls = Array.from(document.querySelectorAll('a[href]'))
                .filter(anchor => anchor.hostname === hostname)
                .map(anchor => anchor.href);

            const sponsorUrls = Array.from(document.querySelectorAll('iframe'))
                .reduce((allLinksFound, iframe) => {
                    const links = Array.from(iframe.contentDocument.querySelectorAll('a[href]'));
                    return allLinksFound.concat(links.map(anchor => anchor.href));
                }, []);

            return { adUrls, siteUrls, sponsorUrls };
        }, AD_INDICATORS, hostname)
        .then((results) => {
            console.log(results);
            processNextInQueue();
        });
}

processNextInQueue();
