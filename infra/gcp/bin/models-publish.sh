#!/usr/bin/env bash
# 検証済みの家具GLBを既存の公開モデルバケットへ配置する。
source "$(dirname "$0")/lib.sh"

need gcloud "GCPの認証後に実行してください。"
need python3 "モデル台帳の検証に使います。"

bucket="${MODELS_BUCKET:-}"
if [ -z "$bucket" ]; then
  need terraform "MODELS_BUCKETを指定するか、Terraformの出力を用意してください。"
  bucket="$(tfout models_bucket)"
fi
[[ "$bucket" =~ ^[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]$ ]] || die "MODELS_BUCKETにはGCSのバケット名を指定してください。"

models_dir="$ROOT/output/furniture_models/furniture"
manifest="$ROOT/backend/db/furniture_models.json"
[ -d "$models_dir" ] || die "GLBがありません。tools/furniture_models/README.mdの生成手順を実行してください。"
staging_dir="$(mktemp -d)"
trap 'rm -rf "$staging_dir"' EXIT
checked_manifest="$staging_dir/catalog.json"

# 台帳に載ったファイルだけを複製し、検証とアップロードで同じ内容を使う。
python3 - "$manifest" "$models_dir" "$staging_dir" <<'PY'
import json
from pathlib import Path
import shutil
import sys

manifest_path, source_dir, staging_dir = map(Path, sys.argv[1:])
models = json.loads(manifest_path.read_text())["models"]
if not models:
    raise ValueError("No models in manifest")
filenames = set()
for model in models:
    key = model["object_key"]
    filename = Path(key).name
    if key != f"models/furniture/v1/{filename}" or not filename.endswith(".glb") or filename in filenames:
        raise ValueError(f"Invalid or duplicate object_key: {key}")
    filenames.add(filename)
    shutil.copyfile(source_dir / filename, staging_dir / filename)
PY

# 寸法・原点・素材・ハッシュを台帳と照合してから、ネットワーク操作に進む。
python3 "$ROOT/tools/furniture_models/manifest.py" \
  --models-dir "$staging_dir" --output "$checked_manifest"
cmp -s "$checked_manifest" "$manifest" || die "GLBと台帳が一致しません。manifest.pyで台帳を更新してください。"

gcloud storage cp --content-type=model/gltf-binary \
  --cache-control='public,max-age=3600' \
  "$staging_dir"/*.glb "gs://$bucket/models/furniture/v1/"
