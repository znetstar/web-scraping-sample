const playwright = require('playwright');
const path = require('path');
const fs = require('fs');
const { Client } = require('pg')
require('dotenv').config();

const polls = {
    trump: [
        'https://www.realclearpolitics.com/epolls/other/president_trump_job_approval-6179.html#polls',
        2021
    ],
    biden: [
        'https://www.realclearpolitics.com/epolls/other/president-biden-job-approval-7320.html#polls',
        2021
    ]
}


async function getApproval(link, endYear = 2021) {
    let anErr, browser, results;
    try {
        // Launch the browser
        browser = await playwright.chromium.launch({
            // Actually show the browser (instead of hidden)
            headless: false
        });
        const context = await browser.newContext();
        const page = await context.newPage();

        // Navigate to the page
        await page.goto(link, {
            waitUntil: 'domcontentloaded'
        });

        // Inject jQuery into the page.
        // this isn't needed, buy jQuery makes navigating the page
        // much easier
        await page.addScriptTag({
            content: fs.readFileSync(
                path.join( __dirname, '..', 'node_modules', 'jquery', 'dist', 'jquery.min.js'  ),
                'utf8'
            )
        });

        // Find a "tag" (attribute) on the page which 
        // can easily be referenced from your code.
        // "ids" (e.g., "id=") are very useful, as as are classes (e.g., "class=")

        // ⚠️ This code runs inside the browser! ⚠️
        results = await page.evaluate(async (year) => {
            return (async ($) => {
                let passOne = 0;
                const results = [];
                // Skip the first two lines
                for (const row of Array.from($('#polling-data-full tr')).slice(2)) {
                    // Each of the columns
                    const cols = Array.from($('td', row));
                    const [
                        pollsterElement,
                        dateElement,
                        sampleSizeElement,
                        approveElement,
                        disapproveElement,
                        spreadElement
                    ] = cols;

                    // Now extract the text
                    const pollster = $('a', pollsterElement).first().text().trim();
                    const dateText = $(dateElement).text().trim();
                    const [ start, end ] = dateText.split('-').map(c => new Date(`${c.trim()}/${year}`))
                    // Year goes down if we hit jan again
                    if (start.getMonth() === 0 && ( passOne <= 3 )) {
                      
                        passOne++;
                    }
                    if (start.getMonth() !== 0 && (passOne > 3)) {
                        passOne = 0;
                        year--;
                    }
                    const approve = Number($(approveElement).text().trim());
                    const disapprove = Number($(disapproveElement).text().trim());

                    results.push({ 
                        startDate: start, endDate: end, approve, disapprove, pollster
                    });
                }
                return results;
            })(window.jQuery);
        }, endYear);
    } 
    
    // If something goes wrong, we still need to close the browser
    // otherwise we might end up with a ton of idle browsers
    catch (err) {
        anErr = err;
    
    } finally {
        await browser.close();
        if (anErr)
            throw anErr;
        return results;
    }
}

(async () => {
    // Run the jobs in parallel to save time
    const allResults = await Promise.all(Object.keys(polls)
        .map(async (name) => {
            const results = await getApproval(...polls[name]);

            const res = results.reverse();

            let top = res[0];
            let topWk = (top.startDate.getFullYear() *  52)+top.startDate.getMonth();

            return res.map((r, i) => {
                r.name = name;
                let  wk =  (r.startDate.getFullYear() *  52)+r.startDate.getMonth();
                r.week = wk-topWk;
                return r;
            })
        }));

    // Connect to the database
    const client = new Client(process.env.POSTGRES_URI)
    await client.connect()

    client.query(`
        DROP TABLE IF EXISTS records;
        CREATE TABLE records (
            week int,
            startDate date,
            endDate date,
            approve int,
            disapprove int,
            pollster text,
            name text
        );
    `)

    let lines = [];
    for (const group of allResults) {
        for (const record of group) {
            lines.push(`INSERT INTO records (week, startDate, endDate, approve, disapprove, pollster, name) VALUES (${record.week}, '${record.startDate.toISOString()}', '${record.endDate.toISOString()}', ${record.approve}, ${record.disapprove}, '${record.pollster}', '${record.name}');`);
        }
    }

    return client.query(lines.join("\n"));
})().catch((err) => {
    console.error(err.stack);
    process.exit(1);
});