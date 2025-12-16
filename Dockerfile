FROM node:alpine

ARG IMAGE_TAG
ENV IMAGE_TAG=$IMAGE_TAG

ENV NODE_ENV=production

WORKDIR /app

COPY . .

RUN npm install

CMD ["npm", "start", "-s"]
