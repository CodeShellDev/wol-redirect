FROM node:alpine

WORKDIR /app

COPY . .

RUN npm install

ENV PORT=80

EXPOSE ${PORT}

CMD ["npm", "start"]
