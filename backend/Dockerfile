FROM node:alpine

RUN apk add --no-cache \
	font-noto fontconfig \
	freetype ttf-dejavu ttf-droid ttf-freefont ttf-liberation \
	chromium python3 make \
	&& rm -rf /var/cache/apk/* /tmp/*

RUN fc-cache -f

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package*.json .
RUN npm i sharp
RUN npm i puppeteer

RUN	addgroup pptruser \
	&& adduser pptruser -D -G pptruser \
	&& mkdir -p /home/pptruser/Downloads \
	&& chown -R pptruser:pptruser /home/pptruser \
	&& chown -R pptruser:pptruser /app

USER pptruser

COPY *.jpg .
COPY *.js .

EXPOSE 18000

CMD ["node","./server.js"]
