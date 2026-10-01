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
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
