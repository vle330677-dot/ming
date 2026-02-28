# 使用官方 Node 镜像
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# [新增] 安装构建 native 模块所需的工具 (Python, Make, G++)
RUN apk add --no-cache python3 make g++

# 复制 package.json 和 lock 文件
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制所有源代码
COPY . .

# 构建前端页面
RUN npm run build

# 暴露端口
EXPOSE 3000

# 强制设置为生产环境
ENV NODE_ENV=production

# 启动 Node.js 服务器
CMD ["npm", "run", "start"]
