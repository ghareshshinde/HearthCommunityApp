FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production DATABASE_PATH=/data/hearth.db
COPY --from=build /app ./
VOLUME /data
EXPOSE 3000
CMD ["npm", "run", "start"]
