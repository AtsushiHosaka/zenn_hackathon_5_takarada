"""書き出したGLBを公開バケットへ置き、管理API経由でDBへ登録する。通常のPythonで実行。

    python3 tools/furniture_models/publish.py --api https://API --bucket BUCKET cushion bed_cover__101
    python3 tools/furniture_models/publish.py --api http://localhost:3000 --no-upload cushion
    python3 tools/furniture_models/publish.py --api https://API --export backend/db/furnitures.json
    python3 tools/furniture_models/publish.py --api https://API --catalog-only curtain_tieback

モデルIDにベース名を渡すと、そのモデルの色・サイズ違いもまとめて扱う。
管理者のメールアドレスとパスワードは ADMIN_EMAIL / ADMIN_PASSWORD、無ければ入力を求める。
"""
import argparse
import base64
import getpass
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.error
import urllib.request

from manifest import HERE, ROOT, entry, load_report

PREFIX = "models/furniture/v1"
CATALOG = ROOT / "backend/db/furnitures.json"


def select(report, keys):
    """モデルID (ベース名なら色・サイズ違いも) に当たる書き出し時の記録を返す。"""
    items = []
    for key in keys:
        found = [item for filename, item in sorted(report.items())
                 if filename[:-4] == key or ("__" not in key and filename.startswith(key + "__"))]
        if not found:
            raise SystemExit(f"build_report.json に {key} がありません。先に build.py で書き出してください。")
        items += [item for item in found if item not in items]
    return items


def upload(paths, bucket):
    """GLB を置き、バケット上の大きさと MD5 が手元と同じことを確かめる。"""
    subprocess.run(["gcloud", "storage", "cp", "--content-type=model/gltf-binary", "--cache-control=public,max-age=3600",
                    *map(str, paths), f"gs://{bucket}/{PREFIX}/"], check=True)
    for path in paths:
        described = subprocess.run(["gcloud", "storage", "objects", "describe", f"gs://{bucket}/{PREFIX}/{path.name}",
                                    "--format=json"], check=True, capture_output=True, text=True)
        remote = json.loads(described.stdout)
        data = path.read_bytes()
        if int(remote["size"]) != len(data) or remote["md5_hash"] != base64.b64encode(hashlib.md5(data).digest()).decode():
            raise SystemExit(f"バケット上の {path.name} が手元のファイルと一致しません。")


def request(api, method, path, body=None, token=None):
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = token
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(urllib.request.Request(api + path, data=data, method=method, headers=headers)) as response:
            return response.headers.get("Authorization"), json.loads(response.read() or b"null")
    except urllib.error.HTTPError as error:
        raise SystemExit(f"{method} {path}: {error.code} {error.read().decode(errors='replace')}")


def login(api):
    email = os.environ.get("ADMIN_EMAIL") or input("管理者のメールアドレス: ")
    password = os.environ.get("ADMIN_PASSWORD") or getpass.getpass("パスワード: ")
    token, _ = request(api, "POST", "/api/v1/login", {"identity": {"email": email, "password": password}})
    if not token:
        raise SystemExit("ログインの応答にトークンがありません。")
    return token


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("keys", nargs="*", help="登録するモデルID (ベース名なら色・サイズ違いも)")
    parser.add_argument("--api", required=True, help="APIのオリジン (例: http://localhost:3000)")
    parser.add_argument("--bucket", default=os.environ.get("MODELS_BUCKET"), help="公開モデル用のバケット (既定: MODELS_BUCKET)")
    parser.add_argument("--no-upload", action="store_true", help="GLBを置かずにDBへだけ登録する (バケットに置き済みのとき)")
    parser.add_argument("--catalog-only", action="store_true", help="GLBを測らず、db/furnitures.json の記録をそのままDBへ登録する (推定した辺などの台帳だけの変更)")
    parser.add_argument("--export", type=Path, help="DBの3Dモデルを db/furnitures.json の形で書き出す先")
    parser.add_argument("--models-dir", type=Path, default=ROOT / "output/furniture_models/furniture")
    parser.add_argument("--report", type=Path, default=HERE / "build_report.json")
    args = parser.parse_args()
    api = args.api.rstrip("/")

    if args.export:
        if args.keys:
            parser.error("--export とモデルIDは同時に指定できません")
        _, catalog = request(api, "GET", "/api/v1/admin/furniture_models/export", token=login(api))
        args.export.write_text(json.dumps(catalog, ensure_ascii=False, indent=1) + "\n")
        print(f"{len(catalog['models'])} models -> {args.export}")
        return
    if not args.keys:
        parser.error("モデルIDを指定してください")
    if not args.no_upload and not args.catalog_only and not args.bucket:
        parser.error("--bucket か MODELS_BUCKET を指定してください (置き済みなら --no-upload)")

    # 推定した辺はGLBから測れないので、台帳 (db/furnitures.json) の値を登録する
    catalog = {model["id"]: model for model in json.loads(CATALOG.read_text())["models"]}
    if args.catalog_only:
        missing = [key for key in args.keys if key not in catalog]
        if missing:
            raise SystemExit(f"db/furnitures.json に {', '.join(missing)} がありません。")
        models = [catalog[key] for key in args.keys]
    else:
        # 先に全件を照合し、途中で止まってバケットとDBが食い違うのを避ける
        models = [entry(item, args.models_dir) for item in select(load_report(args.report), args.keys)]
        models = [{**model, **{key: catalog[model["id"]][key] for key in ("estimated_axes",) if key in catalog.get(model["id"], {})}} for model in models]
    if not args.no_upload and not args.catalog_only:
        upload([args.models_dir / Path(model["object_key"]).name for model in models], args.bucket)
    token = login(api)
    for model in models:
        body = {key: value for key, value in model.items() if key not in ("id", "format", "object_key")}
        request(api, "PUT", f"/api/v1/admin/furniture_models/{model['id']}", {"furniture_model": body}, token)
        print(f"OK {model['id']}")


if __name__ == "__main__":
    sys.exit(main())
