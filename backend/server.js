#!/usr/bin/env node

import puppeteer from 'puppeteer';
import sharp from 'sharp';
import fs from 'node:fs';
import http from 'http';

const PORT = 18000;

const dims = { width: 800, height: 480 };
const photo_url = 'http://192.168.0.32:18000/photo.jpg';

// From https://github.com/andrewstephens75/as-dithered-image/blob/main/ditherworker.js
function dither(rgba, { width, height }, cutoff) {
    let slidingErrorWindow = [
        new Float32Array(width),
        new Float32Array(width),
        new Float32Array(width)
    ];

    const offsets = [[1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]];

    let output1 = new Uint8Array(Math.floor(width / 8) * height);
    let output8 = new Uint8Array(width * height);

    for (let y = 0, i = 0, j = 0, k = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x, ++i) {
            let input = Math.floor(rgba[k] * 0.3 + rgba[k + 1] * 0.59 + rgba[k + 2] * 0.11);
            let accumulatedError = Math.floor(slidingErrorWindow[0][x]);
            let expectedMono = input + accumulatedError;
            let monoValue = (expectedMono > Math.floor(cutoff * 255)) ? 255 : 0;
            let error = (expectedMono - monoValue) / 8.0;
            for (let q = 0; q < offsets.length; ++q) {
                let offsetX = offsets[q][0] + x;
                if ((offsetX >= 0) && (offsetX < slidingErrorWindow[0].length))
                    slidingErrorWindow[offsets[q][1]][offsetX] += error;
            }

            output1[j] = (output1[j] << 1) | !!monoValue;
            if ((i % 8) === 7)
                output1[++j] = 0;

            k += 4;

            output8[i] = monoValue;
        }

        // move the sliding window
        slidingErrorWindow.push(slidingErrorWindow.shift());
        slidingErrorWindow[2].fill(0, 0, slidingErrorWindow[2].length);
    }

    return [output1, output8];
}


function daysUntil(date, name) {
    const now = new Date();
    const then = new Date(date);
    const diff = 1 + Math.floor((then - now) / (1000 * 60 * 60 * 24));
    return `
<div class="daysUntil">
<h1>${diff}</h1>
<h3>day${diff==1 ? '' : 's'} until</h3>
<h2>${name}</h2>
</div>
`;
};

function html(events) {
    const now = new Date();
    let dateString = (new Date(Date.now() + 7200000)).toString().toUpperCase().split(' ');
    dateString = [dateString[0], dateString[2], dateString[1]].join(' ');

    if ('string' === typeof events)
        events = JSON.parse(events);
    
    const els =
        events
            .map(([date, name]) => [new Date(date), name])
            .filter(([date, name]) => date >= now)
            .sort(([ad, an], [bd, bn]) => ad - bd)
            .map(([date, name]) => daysUntil(date, name))
            .join('\n');


    return `
<!DOCTYPE html>
    <html>
        <head>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <style>
@import url('https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@300;700;900&display=swap');
* {
    font-family: 'Roboto Condensed', sans-serif;
    -webkit-font-smoothing: none;
}

html, body {
    width: 800px;
    height: 480px;
    margin: 0;
    outline: 1px solid black;
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
}
#container {
    width: 800px;
    height: 480px;
    margin: 0;
    padding: 0;
    outline: 1px solid black;
    display: flex;
    justify-content: space-between;
    align-items: start;
}
img {
    max-width: 50%;
    box-shadow: 3px 3px 6px #eee;
    border-radius: 6px;
}
#left {
    width: 50vw;
    height: 480px;
    background-image: url(${photo_url});
    background-position-x: -100px;
    display: flex;
    flex-direction: column-reverse;
    align-items: center;
}
#debug { 
    position: absolute;
    top: -4px;
    right: 0;
    color: black;
    font-family: 'Roboto Condensed', sans-serif;
    font-size: 18px;
    font-weight:bold;
}
#left h1 {
    font-family: 'Roboto Condensed', sans-serif;
    color: white;
    font-size: 60px;
    text-shadow: 0 0 10px black, 0 0 10px black, 0 0 10px black, 0 0 10px black, 0 0 10px black, 0 0 10px black
}
#right {
    width: 50vw;
    height: 480px;
    border-left: 1px solid black;
    font-family: 'Roboto Condensed', sans-serif;
    background: white;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
}
.daysUntil {
    display: flex;
    flex-direction: column;
/*    justify-content: space-between;*/
    align-items: center;
    background: #fff;
    margin: 0 0.25em;
}
.daysUntil h1, .daysUntil h2, .daysUntil h3 {
    text-align: center;
    margin: 0;
}

.daysUntil h1 {
    font-size: 70px;
    letter-spacing: -0.02em;
}
.daysUntil h2 {
    text-transform: uppercase;
    font-size: 17px;
    margin-top: 5px;
    font-weight: 900;
}
.daysUntil h3 {
    margin-top: -15px;
    font-size: 12px;
}
            </style>
        </head>
    <body>
        <div id="container">
        <div id="left">
            <h1>${dateString}</h1>
            </div>
            <div id="right">
<div id="debug">${((new Date()).toLocaleString().toUpperCase().split(' '))[4]}</div>
                ${els}
            </div>
        </div>
    </body>
</html>
`;
}

async function make(html) {
    const browser = await puppeteer.launch({ headless: 'new' });

    const page = await browser.newPage();

    //    await page.goto('http://192.168.0.38:8000/test2.png');

    await page.setViewport(dims);

    await page.setContent(html);

    await page.waitForNetworkIdle();

    const png = await page.screenshot();

    await browser.close();

    // Create sharp image object from png buffer
    const buffer = await sharp(png)
        .raw({ depth: 'uchar' })
        .toBuffer();

    return dither(buffer, dims, .25);
}

(async () => {
    http.createServer(async (req, res) => {
        try {
            switch (req.method.toLowerCase()) {
                case 'get':
                    let m;

                    if ((m = `${req.url}`.match(/\.(png|raw|html)(.*)/))) {
                        var events = await fs.promises.readFile('./events.json', 'utf8');
                        events = JSON.parse(events);

                        switch (m[1]) {
                            case 'html':
                                res.writeHead(200, { 'Content-Type': 'text/html' });
                                res.write(html(events));
                                res.end('');
                                break;

                            case 'png':
                                var [output1, output8] = await make(html(events));
                                const buf = await sharp(output8, {
                                    raw: { width: dims.width, height: dims.height, channels: 1 }
                                }).png().toBuffer();

                                res.writeHead(200, { 'Content-Type': 'image/png' });
                                res.write(buf);
                                res.end('');
                                break;

                            case 'raw':
                                var [output1, output8] = await make(html(events));
                                res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
                                res.write(output1);
                                res.end('');
                                break;

                            default:
                                throw new Error('404 Not Found');
                        }
                    }
                    else if ((m = `${req.url}`.match(/\/(\w+).jpg/))) {
                        const fn = `./${m[1]}.jpg`;
                        if (! fs.existsSync(fn))
                            throw new Error('404 Not Found');

                        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
                        res.write(await fs.promises.readFile(fn));
                        res.end('');
                        break;
                    }
                    else {
                        throw new Error('404 Not Found');
                    }
                    break;

                default:
                    throw new Error('405 Method not allowed');
            }

            console.log(res._header);
        }
        catch (e) {
            console.log(e);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.write(e.message);
            res.end('');
        }
    }).listen(PORT);
})();
