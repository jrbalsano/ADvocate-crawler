# ADvocate Web Crawler

This Web Crawler searches sites for ads in iframes and assumes them to be from legitimate advertisers. Given a seed site
you can tell it to track down all the ads on a site and figure out who's paying to keep that site alive.

## Motivation

Fakes news has jettisoned itself to the top of the list of problems for keeping our electorate well infored, but there's a
solution. Fake news exists in part because it's a great financial opportunity. Fakes news attracts eyes and those eyes can be
sold to advertisers. Fortunately, its unlikely companies we care about are advertising on fake news sites, but it _is_ often
the case that their ads are showing up on similar click-bait sites that advertise on fake news sites. This web crawler visits
a seed page and follows the ads and other links on the site to try to find `<iframe>` tags because those generally contain
content from more reputable ad platforms like google adsense. It then writes these sponsors to the specified mongo url where
they can be queried by hostname, url, and the path taken to get to them.

## Usage

First, clone this repo. Then from inside the repo run

```bash
npm install
node index.js --seed <seed_site> --mongoUri <mongoUri>
```

* `seed_site` is the starting url for the crawler. Try "http://occupydemocrats.com" if you need an idea
* `mongoUri` is the url for the mongodb instance you want to write to. If you start a `mongod` instance locally, you can
    probably use "mongodb://localhost:27017"
