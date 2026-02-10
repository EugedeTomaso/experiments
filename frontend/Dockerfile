FROM node:20-slim

WORKDIR /app

COPY package.json /app/package.json
COPY package-lock.json /app/package-lock.json
RUN npm install

COPY . /app

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
