# 22 LTS: yahoo-finance2 v3 requires >= 22.
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3001
ENV CHOKIDAR_USEPOLLING=true
CMD ["npm", "run", "dev"]