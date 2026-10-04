# 開発用 (compose.override.yaml の web サービスが使う)。Vite の dev server を動かす。
FROM node:24-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

# 本番用の静的ファイルを作る
FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# VITE_ で始まる値は**ビルド時にバンドルへ埋め込まれる**。秘密は渡さない
ARG VITE_API_ENDPOINT
ARG VITE_CONNECTION=api
RUN npm run build

# 配信。SPA なので存在しないパスは index.html に落とす
FROM nginx:1.27-alpine AS runtime
ENV API_UPSTREAM_ORIGIN=https://zenn-hackathon-api-262220651661.asia-northeast1.run.app
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
