FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
# Cloud Run sets PORT (8080). The database is a local file that is backed up to Cloud Storage when GCS_BUCKET is set.
ENV NODE_ENV=production PORT=8080 DATABASE_PATH=/data/hearth.db
COPY --from=build /app ./
EXPOSE 8080
CMD ["npm", "run", "start"]
