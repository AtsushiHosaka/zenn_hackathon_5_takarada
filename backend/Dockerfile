# 開発しやすさ優先の1段ビルド
FROM ruby:3.3-slim

ENV LANG=C.UTF-8 \
    TZ=Asia/Tokyo \
    BUNDLE_PATH=/usr/local/bundle

RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
      build-essential libpq-dev postgresql-client git curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Gemfile Gemfile.lock ./
RUN bundle install

COPY . .

EXPOSE 3000
CMD ["bin/rails", "server", "-b", "0.0.0.0", "-p", "3000"]
