# 22 LTS: Vite 7 requires Node ^20.19 || >=22.12, and matches the backend.
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
