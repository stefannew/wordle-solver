FROM buildkite/puppeteer

COPY . /app

WORKDIR /app

RUN npm install

USER node

CMD ["npm", "run", "server"]
