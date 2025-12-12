FROM node:alpine

WORKDIR /app

COPY . .

RUN npm install

CMD ["npm", "--loglevel warn", "start"]
