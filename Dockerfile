# 1. 使用 slim 镜像替代 alpine，它包含更好的原生插件支持
FROM node:20-slim

# 2. 安装编译 better-sqlite3 所需的系统依赖
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
# 确保在容器环境内重新编译原生模块
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000
ENV NODE_ENV=production

CMD ["npm", "run", "start"]
