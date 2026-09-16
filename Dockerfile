FROM node:20-alpine
ARG YAPI_IMAGE_VERSION=0.1.0
ENV TZ="Asia/Shanghai"
ENV HUSKY=0
ENV YAPI_IMAGE_VERSION=${YAPI_IMAGE_VERSION}
LABEL org.opencontainers.image.title="YApi" \
  org.opencontainers.image.version="${YAPI_IMAGE_VERSION}" \
  org.opencontainers.image.description="YApi 0.1.0：服务端代发接口请求，无需 Chrome 跨域插件；并解决原版停更无法部署、跨架构无法直接 pull、必须挂载 config.json 才能启动等问题"

RUN apk add --no-cache python3 make g++

WORKDIR /yapi/vendors

COPY package.json package-lock.json ./
RUN npm install --omit=dev --ignore-scripts

COPY . .
COPY docker/config.json /yapi/config.json

EXPOSE 3000
ENTRYPOINT ["/bin/sh", "/yapi/vendors/docker/start.sh"]
