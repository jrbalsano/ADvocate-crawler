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
const fakeNewsSites = [ 'http://occupydemocrats.com/2016/08/19/donald-trumps-campaign-goes-full-racist-calls-obama-half-breed-negro-2/', 'http://occupydemocrats.com/' ];
let stack = fakeNewsSites.map(url => { return { url, path: [] }; });
const sponsors = {};
const adSites = {};
const AD_INDICATORS = ['ads by', 'advertisement', 'sponsored links'];
const LIKELY_IFRAMES = [
    /facebook\.com$/,
    /youtube\.com$/,
    /instagram\.com$/,
    /twitter\.com$/
];
const SKIP_HOSTNAMES = [
    /adblade\.com$/
];

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

function processNextInStack() {
    if (!stack.length) {
        nightmare.then(); // ensure nightmare acts on last action in `after`, if any
        nightmare.end();
        return;
    }

    const { url, path } = stack.shift();
    const hostname = urlHelper.parse(url).hostname;

    if (!url || passed[url] || path.length > 2) {
        processNextInStack();
        return;
    }

    if (SKIP_HOSTNAMES.reduce((found, iframe) => found || iframe.test(hostname), false)) {
        processNextInStack();
        return;
    }

    if (path.length > 2) {
        const uniqueHostnamesInPath = Object.keys(path.reduce((checkedHostnames, currentPath) => {
            const newHostname = urlHelper.prase(currentPath).hostname;
            if (!newHostname) {
                return;
            }
            checkedHostnames[newHostname] = true;
        }, {})).length;

        if (uniqueHostnamesInPath > 2) {
            return;
        }
    }

    console.log('Sponsors', Object.keys(sponsors));
    console.log(`Stack ${stack.length} total`, stack.map(obj => obj.url).slice(0,10));
    passed[url] = true;
    adSites[hostname] = true;

    nightmare
        .goto(url)
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
        .then(({ adUrls, siteUrls, sponsorUrls }) => {
            const newPath = path.concat(url);
            stack = adUrls.map(newUrl => {
                    return {
                        url: newUrl,
                        path: newPath
                    };
                })
                .concat(siteUrls.map(newUrl => {
                    return {
                        url: newUrl,
                        path: newPath
                    };
                }))
                .concat(stack);

            let promiseChain;
            sponsorUrls.forEach((url) => {
                const currentHostname = urlHelper.parse(url).hostname;
                if (LIKELY_IFRAMES.reduce((found, iframe) => found || iframe.test(currentHostname), false)) {
                    return;
                }

                if (adSites[currentHostname]) {
                    return;
                }

                function checkThisSponsor() {
                    if (sponsors[currentHostname]) {
                        const alreadyFoundFromThisSite = sponsors[currentHostname].reduce((alreadyFound, pathToSponsor) => {
                            return alreadyFound || pathToSponsor[0] === newPath[0];
                        }, false);

                        if (alreadyFoundFromThisSite) {
                            return;
                        }
                    }

                    console.log('awaiting sponsor', urlHelper.parse(url).hostname);
                    return nightmare
                        .goto(url)
                        .url()
                        .then(sponsorUrl => {
                            const sponsorHostname = urlHelper.parse(sponsorUrl).hostname;
                            console.log('checking sponsor', sponsorHostname);
                            if (adSites[sponsorHostname]) {
                                return;
                            }

                            console.log('saving sponsor', sponsorHostname);
                            if (sponsors[sponsorHostname]) {
                                sponsors[sponsorHostname].concat(newPath);
                            } else {
                                sponsors[sponsorHostname] = [newPath];
                            }
                        }).catch(error => {
                            console.error('Sponsor search failed:', error);
                            processNextInStack();
                        });
                }
                if (promiseChain) {
                    promiseChain = promiseChain.then(checkThisSponsor);
                } else {
                    promiseChain = checkThisSponsor();
                }
            });

            if (promiseChain) {
                promiseChain.then(processNextInStack);
            } else {
                processNextInStack();
            }
        }).catch(function (error) {
            console.error('Search failed:', error);
        });
}

processNextInStack();
