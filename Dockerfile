FROM node:alpine

WORKDIR /app

COPY . .

RUN npm install --loglevel warn

CMD ["npm", "start"]
