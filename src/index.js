const playwright = require('playwright');
const path = require('path');
const fs = require('fs');

async function getApproval(link, endYear = 2021) {
    let anErr, browser;
    try {
        // Launch the browser
        browser = await playwright.chromium.launch();
        const context = await browser.newContext();
        const page = await context.newPage();

        // Navigate to the page
        await page.goto(link);

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
        await page.evaluate(async (year) => {
            return (async ($) => {
                let passOne = false;
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
                    const pollster = $(pollsterElement).text().trim();
                    const dateText = $(dateElement).text().trim();
                    const [ start, end ] = dateText.split('-').map(c => new Date(`${c.trim()}/${year}`))
                    // Year goes down if we hit jan again
                    if (start.getMonth() === 0 && !passOne) {
                        year--;
                        passOne = true;
                    }
                    if (start.getMonth() !== 0 && passOne) {
                        passOne = false;
                    }
                    const approve = Number($(approveElement).text().trim());
                    const disapprove = Number($(disapproveElement).text().trim());


                    return { 
                        start, end, approve, disapprove, link, pollster
                    }
                }
            })(window.jQuery);
        }, endYear)
    } 
    // If something goes wrong, we still need to close the browser
    // otherwise we might end up with a ton of idle browsers
    catch (err) {
        anErr = err;
    
    } finally {
        await browser.close();
        if (anErr)
            throw anErr;
    }
}

(async () => {


})().catch((err) => {
    console.error(err.stack);
    process.exit(1);
});