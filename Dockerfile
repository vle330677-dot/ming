# 修改 Dockerfile 顶部，增加构建依赖
FROM node:20-alpine
RUN apk add --no-cache python3 make g++  # better-sqlite3 编译需要
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "run", "start"]
