# 家具モデルを AI で作るジョブのイメージ。ビルドの起点は tools/furniture_models:
#   docker build -f tools/furniture_models/generator/Dockerfile tools/furniture_models
# Blender 本体は入れず、Python 用の部品 (bpy) だけを使う。GPU は使わない (描画は Cycles の CPU)。
FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      libx11-6 libxrender1 libxi6 libxxf86vm1 libxfixes3 libxkbcommon0 libsm6 libice6 libgomp1 libgl1 libegl1 \
    && rm -rf /var/lib/apt/lists/*
# bpy は既存の道具を確認した版 (Blender 5.1) に固定する
RUN pip install --no-cache-dir "bpy==5.1.2" numpy google-auth requests google-cloud-storage
WORKDIR /app/tools
# 部品ライブラリと、AI に見せるお手本
COPY lib.py palette.py models_seating.py models_lights.py models_storage.py ./
COPY generator ./generator
CMD ["python", "generator/generate.py"]
