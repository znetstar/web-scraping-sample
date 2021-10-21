# Web Scraping Sample

This project aggregates results from [weekly American presidental opinion polls](https://realclearpolitics.com), for use as sample data.

Included is a node.js web scraper (`src/index.js`), and a Tableau workbook (`misc/Tableau Chart.twb`) for visually representing the data.

 ![Chart](./misc/chart.png)

## Purpose

The purpose of this project is to demonstrate how `playwright` and `node.js` can be be used  to collect large volumes of data, and, additionally, how Tableau can be used to display it.

The logic inside of `page.evaluate` in `src/index.js` could easily be applied to any web page with table data in a similar format.

### Tech 

The node.js project uses the `playwright` browser automation library which in automates Google Chrome (Chromium). Postgresql is used as a database, and Docker is used to deploy Postgres.

# Run

1. Copy `.env.sample` to `.env`
2. Run `npm install`
3. Start database with `docker-compose up -d postgres`
3. Run `npm start`

## License

This project has been contributed to the public domain.
