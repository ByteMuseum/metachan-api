FROM node:22

WORKDIR /metachan

COPY package*.json ./

RUN npm install

RUN npm run build

COPY dist .

EXPOSE 3000

CMD ["npm", "start"]
