FROM ghcr.io/puppeteer/puppeteer:latest

COPY package.json .
COPY yarn.lock .
RUN yarn

COPY *.jpg .
COPY *.js .

CMD ["node","./server.js"]
