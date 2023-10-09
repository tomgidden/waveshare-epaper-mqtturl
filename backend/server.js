#!/usr/bin/env node

import puppeteer from 'puppeteer';
import sharp from 'sharp';
import fs from 'node:fs';
import http from 'http';
import config from './config.js';

const port = config.port ?? 18000;
const slew = config.slew ?? 0;

var _now, yyyymmdd;


const eventsPath = config.eventsPath ?? `./var/events`;//.json
const timetablePath = config.timetablePath ?? `./schoolscrape/timetable`;//.yyyy-mm-dd.json
const homeworkPath = config.homeworkPath ?? `./schoolscrape/homework`;//.yyyy-mm-dd.json

const photoUrl = config.photoUrl ?? '/static/photo.jpg';


const dims = { width: 800, height: 480 };

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

            if (x >= width / 2)
                monoValue = input > 120 ? 255 : 0;

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
    const now = new Date(_now);
    const then = new Date(date);
    const diff = 1 + Math.floor((then - now) / (1000 * 60 * 60 * 24));
    return `
<div class="daysUntil">
<h1>${diff}</h1>
<h3>day${diff == 1 ? '' : 's'} until</h3>
<h2>${name}</h2>
</div>
`;
};

function getNextTimetableDay(timetable) {
    let now = new Date(_now);
    now.setDate(now.getDate() + slew);
    let today = new Date(now);
    today.setHours(2);

    timetable = timetable
        .filter(tt => tt.ts >= today)
        .sort((a, b) =>
            (a.yyyymmdd.localeCompare(b.yyyymmdd)) ||
            (a.time.localeCompare(b.time)) ||
            (a.p.localeCompare(b.p))
        );

    if (timetable.length == 0) return [];

    if (now.getHours() >= 12) {
        if (timetable[0].ts < now) {
            now.setDate(now.getDate() + 1);
            today.setDate(today.getDate() + 1);
            timetable = timetable.filter(tt => tt.ts >= today);
        }
    }

    if (timetable.length == 0) return [];

    const tt = timetable
        .filter(tt => tt.yyyymmdd == timetable?.[0]?.yyyymmdd)

    return tt;
}

function getTimetableEls(timetable) {
    const tts = getNextTimetableDay(timetable);

    if (tts.length == 0) return undefined;

    const now = new Date(_now);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const then = new Date(tts[0].ts);

    let dayString;
    // If now and then are on the same day
    if (now.getFullYear() == then.getFullYear() &&
        now.getMonth() == then.getMonth() &&
        now.getDate() == then.getDate()) {
        dayString = 'Today';
    }
    else if (tomorrow.getFullYear() == then.getFullYear() &&
        tomorrow.getMonth() == then.getMonth() &&
        tomorrow.getDate() == then.getDate()) {
        dayString = 'Tomorrow';
    }
    else {
        dayString = then.toLocaleDateString('en-GB', { weekday: 'long' });
    }

    const title = `<div class="timetable-date">${dayString}</div>`;

    const lessons = tts
        .map(tt => {
            tt.end = undefined;
            tt.until = '';
            if (tt.duration) {
                tt.end = new Date(tt.ts);
                tt.end.setMinutes(tt.end.getMinutes() + tt.duration);
                tt.until = `[${tt.end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}]`;
                tt.until = `<span class="until">${tt.until}</span>`;
            }
            return tt;
        })
        .map(tt => `<div class="timetable-lesson">
<div class="timetable-period">
${tt.time}: <span class="${(tt.replacement || tt.kit || tt.p === '+') ? 'bold' : ''}">${tt.p} ${tt.name} ${tt.until}</span>
</div>
</div>`);

    if (lessons.length == 0) return undefined;

    let notes = [];

    if (tts.filter(tt => (tt.kit) && tt.name !== 'Scouts').length > 0)
        notes.push(`<div class="timetable-note"><div>KIT</div></div>`);
    if (tts.filter(tt => tt.replacement).length > 0)
        notes.push(`<div class="timetable-note"><div>EXTRA</div></div>`);

    return { lessons, notes, title };
}

function html(data) {
    const now = new Date(_now);
    let dateString = (new Date(now.getTime() + 7200000)).toString().toUpperCase().split(' ');
    dateString = [dateString[0], parseInt(dateString[2]), dateString[1]].join(' ');

    const events = data.events
        .map(([date, name]) => [new Date(date), name])
        .filter(([date, name]) => date >= now)
        .sort(([ad, an], [bd, bn]) => ad - bd)
        .map(([date, name]) => daysUntil(date, name));

    const _timetable = getTimetableEls(data.timetable);
    let timetable = undefined;
    if (_timetable) {
        const { lessons, notes, title } = _timetable;
        timetable = [
            `<div class="timetable-lessons">${lessons.join("\n")}</div>`,
            `<div class="timetable-head">${title}</div>`,
            `<div class="timetable-notes">${notes.join("\n")}</div>`
        ];
    }

    return `
<!DOCTYPE html>
    <html>
        <head>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <style>

@import url('https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@400;700;900&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;700;900&display=swap');

${fs.readFileSync('./static/style.css', 'utf8')}
* {
    -webkit-font-smoothing: none;
    font-smooth: never;
}

#left {
    background-image: url(${photoUrl});
}

        </style>
        </head>
    <body>
        <div id="container">
        <div id="left">
            <h1>${dateString}</h1>
            </div>
            <div id="right">
                ${timetable === undefined ? '<div class="hidden">' : ''}
                <div id="timetable">${(timetable ?? []).join("\n")}</div>
                ${timetable === undefined ? '</div>' : ''}
                <div id="events">${events.join("\n")}</div>
            </div>
        </div>
    </body>
</html>
`;
}

async function make(html) {
    const browser = await puppeteer.launch({ headless: 'new' });

    const page = await browser.newPage();

    await page.setViewport(dims);

    await page.goto('http://localhost:18000/output.html');

    await page.waitForNetworkIdle();

    const png = await page.screenshot();

    await browser.close();

    // Create sharp image object from png buffer
    const buffer = await sharp(png)
        .raw({ depth: 'uchar' })
        .toBuffer();

    return dither(buffer, dims, .25);
}

async function getData() {
    var events = await fs.promises.readFile(`${eventsPath}.json`, 'utf8');
    events = JSON.parse(events);
    events = events.filter(([date, name, skip]) => new Date(date) >= _now && skip !== true);

    var timetable = await fs.promises.readFile(`${timetablePath}.${yyyymmdd}.json`, 'utf8');
    timetable = JSON.parse(timetable)
        .map(tt => ({ ...tt, ts: new Date(tt.ts) }));

    var homework = await fs.promises.readFile(`${homeworkPath}.${yyyymmdd}.json`, 'utf8');
    homework = JSON.parse(homework);

    return {
        events,
        timetable,
        homework
    };
}

(async () => {
    const data = await getData();

    http.createServer(async (req, res) => {
        _now = new Date();
        if (slew) _now.setDate(_now.getDate() + slew);
        yyyymmdd = _now.toISOString().split('T')[0];

        try {
            switch (req.method.toLowerCase()) {
                case 'get':
                    let m;
                    console.log(`${req.method} ${req.url}`);

                    if ((m = `${req.url}`.match(/\/static\/(\w+).(\w+)/))) {
                        const fn = `./${req.url}`;
                        if (!(fs.existsSync(fn)))
                            throw new Error('404 Not Found');

                        const type = {
                            'png': 'image/png',
                            'css': 'text/css',
                            'js': 'text/javascript',
                            'jpg': 'image/jpeg'
                        }[m[2]] ?? 'application/octet-stream';

                        const s = fs.createReadStream(fn);
                        res.writeHead(200, { 'Content-Type': type });

                        s
                            .on('end', () => { res.end(''); })
                            .on('open', () => { s.pipe(res); });
                    }

                    else if ((m = `${req.url}`.match(/\.(png|raw|html)(.*)/))) {
                        const data = await getData();

                        switch (m[1]) {
                            case 'html':
                                res.writeHead(200, { 'Content-Type': 'text/html' });
                                res.write(html(data));
                                res.end('');
                                break;

                            case 'png':
                                var [output1, output8] = await make(html(data));
                                const buf = await sharp(output8, {
                                    raw: { width: dims.width, height: dims.height, channels: 1 }
                                }).png().toBuffer();

                                res.writeHead(200, { 'Content-Type': 'image/png' });
                                res.write(buf);
                                res.end('');
                                break;

                            case 'raw':
                                var [output1, output8] = await make(html(data));
                                res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
                                res.write(output1);
                                res.end('');
                                break;

                            default:
                                throw new Error('404 Not Found');
                        }
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
    }).listen(port);
})();
