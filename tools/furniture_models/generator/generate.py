"""商品の画像と寸法から、Gemini に家具モデルの定義を書かせ、検査・組み立て・描画までを行うジョブ。

入力と出力は 1 つの置き場 (GENERATION_URI) にまとめる。gs://バケット/パス か、手元のディレクトリ。
  入力: request.json  {"model_key", "name", "category", "size": {"w","h","d"}, "color", "material", "image_url"}
  出力: result.json   {"status": "succeeded"|"failed", "error", "checks", "stats", "ai", "notes"}
        model.py (AI が書いた定義) / model.glb / front.png / side.png  (組み立てられたときだけ)

このジョブはデータベースにも秘密の値にも触れない。AI が書いたコードは checks.check_source を通ったものだけを、別プロセスで実行する。
検査に落ちたら、理由を AI に返して書き直させる (AI の呼び出しは合計 MAX_AI_CALLS 回まで)。
見た目を AI に見比べさせる自動の修正はしない (試験で、直して悪くなる例があったため)。採用するかは人が画像を見て決める。
"""
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = os.path.dirname(HERE)
sys.path.insert(0, HERE)

import checks  # noqa: E402

MAX_AI_CALLS = 3
# アプリ本体の GEMINI_MODEL (軽いモデル) とは別に決める。軽いモデルでは形を組み立てきれない
MODEL = os.environ.get("MODEL_GENERATION_MODEL") or "gemini-3.1-pro-preview"
EXAMPLES = [("models_seating.py", None), ("models_lights.py", None), ("models_storage.py", 9000)]
SCHEMA = {
    "type": "object",
    "properties": {
        "code": {"type": "string", "description": "Python モジュール全文"},
        "notes": {"type": "string", "description": "形の捉え方・直した点を 60 文字以内"},
    },
    "required": ["code", "notes"],
}


class Store:
    """置き場。gs:// なら GCS、それ以外は手元のディレクトリ。"""

    def __init__(self, uri):
        self.uri = uri.rstrip("/")
        if self.uri.startswith("gs://"):
            from google.cloud import storage

            bucket, _, self.prefix = self.uri[5:].partition("/")
            self.bucket = storage.Client().bucket(bucket)
        else:
            self.bucket = None
            os.makedirs(self.uri, exist_ok=True)

    def read(self, name):
        if self.bucket:
            return self.bucket.blob(f"{self.prefix}/{name}").download_as_bytes()
        with open(os.path.join(self.uri, name), "rb") as file:
            return file.read()

    def write(self, name, data, content_type):
        if self.bucket:
            self.bucket.blob(f"{self.prefix}/{name}").upload_from_string(data, content_type=content_type)
        else:
            with open(os.path.join(self.uri, name), "wb") as file:
                file.write(data)


def read_tool(name, limit=None):
    with open(os.path.join(TOOLS, name), encoding="utf-8") as file:
        text = file.read()
    return text[:limit] if limit else text


def base_prompt(request):
    size = request["size"]
    key = request["model_key"]
    examples = "\n".join(f"# お手本 ({name})\n```python\n{read_tool(name, limit)}\n```" for name, limit in EXAMPLES)
    return f"""あなたは、Blender の Python で家具の3Dモデルを組み立てる定義を書きます。下の「部品ライブラリ」と「お手本」と同じ書き方で、商品画像に似た形のモデル定義を1つ書いてください。

# 決まり
- 出力は Python のモジュール全文。import は `import math`、`import palette as P`、`from lib import Model, asset` の3つだけ (必要なものだけ)。ほかの import、ファイル操作、class、try は使えない。
- `@asset("{key}.glb", ({size['w']}, {size['h']}, {size['d']}))` を付けた関数をちょうど1つ定義する。引数は `tint=None`。`Model("{key}")` を作って返す。
- 寸法は (幅, 高さ, 奥行き) メートル。座標は +Y が上、+Z が正面 (座る側・扉が開く側)、底面は y=0、左右は x=0 を中心にする。
- 仕上げ (finish) で全体の寸法が上の値から 8% 以上ずれるとエラーになる。全体がちょうどこの寸法の箱に収まるように部品を置く。
- 部品どうしは必ず接するか少し食い込ませる。宙に浮いた部品、離れた部品があると検査で落ちる。
- 部位 (素材) の名前は次の中から選ぶ: {', '.join(sorted(checks.ALLOWED_MATERIALS))}。色を変える主な部位は "tint" (色は `tint or 既定色`) にする。全体が透明な家具など tint にできないときも、{', '.join(checks.RECOLORABLE_MATERIALS)} のどれかを1つは使う。
- 光らせてよい部位は "light" だけ (emit を指定し、strength は {checks.MAX_EMISSION_STRENGTH} 以下)。ランプの笠も、光源そのものでなければ光らせない。透けてよいのは "glass" と "acrylic" だけ。
- 三角形は {checks.MAX_TRIANGLES} 以下 (目安は 4000 以下)。subsurf や細かい分割を重ねすぎない。
- 面のはっきりしたマットなイラスト調。部材はやや太め。小物・コード・床・壁は作らない。
- ライブラリにある部品のメソッド (box, box_at, cyl, rod, sphere, lathe, prism, cushion, surface, deform, bevel, subsurf) だけを使う。bpy を直接使わない。

# 部品ライブラリ (lib.py)
```python
{read_tool('lib.py')}
```
# 色 (palette.py)
```python
{read_tool('palette.py')}
```
{examples}

# 作る商品
商品名: {request['name']}
種類: {request['category']} / 寸法 (幅×高さ×奥行き m): {size['w']}×{size['h']}×{size['d']} / 代表色: {request.get('color') or '不明'} / 素材: {request.get('material') or '不明'}
"""


def fetch_image(url):
    if not url or not url.startswith("https://"):
        return None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "image/jpeg,image/png,image/*"})
        with urllib.request.urlopen(req, timeout=20) as response:
            mime = response.headers.get_content_type()
            data = response.read(6_000_000)
        return {"mime_type": mime, "data": data} if mime in ("image/jpeg", "image/png", "image/webp") else None
    except Exception:
        return None


def ask_gemini(session, project, text, image):
    """Vertex AI の Interactions API (backend の GeminiClient と同じ呼び方)。(JSON, 使用量, 秒) を返す。"""
    body = {
        "model": MODEL, "store": False, "response_format": SCHEMA, "response_mime_type": "application/json",
        "input": [{"type": "text", "text": text}] + ([{"type": "image", "mime_type": image["mime_type"], "data": base64.b64encode(image["data"]).decode()}] if image else []),
    }
    started = time.time()
    for attempt in range(3):
        response = session.post(f"https://aiplatform.googleapis.com/v1beta1/projects/{project}/locations/global/interactions", json=body, timeout=420)
        if response.status_code not in (429, 500, 502, 503, 504):
            break
        time.sleep(5 * (attempt + 1))
    if response.status_code != 200:
        raise RuntimeError(f"Gemini がエラーを返しました ({response.status_code}): {response.text[:200]}")
    payload = response.json()
    if payload.get("status") != "completed":
        raise RuntimeError(f"Gemini の生成が完了しませんでした (status: {payload.get('status')})")
    text = "".join(content.get("text", "") for step in payload.get("steps", []) if step.get("type") == "model_output"
                   for content in step.get("content", []) if content.get("type") == "text")
    usage = {key: payload.get("usage", {}).get(key, 0) for key in ("total_input_tokens", "total_output_tokens", "total_thought_tokens")}
    return json.loads(text), usage, round(time.time() - started)


def run(script, *args, timeout=240):
    """build.py / render.py を別プロセスで動かす。認証に使う環境変数は渡さない。"""
    env = {key: value for key, value in os.environ.items() if not key.startswith(("GOOGLE_", "GEMINI_", "GENERATION_", "MODEL_", "CLOUD_RUN_"))}
    return subprocess.run([sys.executable, os.path.join(HERE, script), *args], capture_output=True, text=True, timeout=timeout, env=env)


def build(code, request, work):
    path = os.path.join(work, "model.py")
    with open(path, "w", encoding="utf-8") as file:
        file.write(code)
    size = request["size"]
    try:
        done = run("build.py", path, request["model_key"], str(size["w"]), str(size["h"]), str(size["d"]), work)
    except subprocess.TimeoutExpired:
        return {"ok": False, "checks": [], "error": "組み立てが時間内に終わりませんでした (形が複雑すぎます)"}
    line = next((line for line in reversed(done.stdout.splitlines()) if line.startswith("RESULT ")), None)
    if line is None:
        return {"ok": False, "checks": [], "error": "組み立てが異常終了しました: " + (done.stderr or done.stdout)[-800:]}
    return json.loads(line[len("RESULT "):])


def main():
    store = Store(os.environ["GENERATION_URI"])
    request = json.loads(store.read("request.json"))
    result = {"status": "failed", "error": None, "checks": [], "stats": None, "notes": None,
              "ai": {"model": MODEL, "calls": 0, "seconds": 0, "input_tokens": 0, "output_tokens": 0}}
    try:
        import google.auth
        from google.auth.transport.requests import AuthorizedSession

        credentials, default_project = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
        project = os.environ.get("GOOGLE_CLOUD_PROJECT") or default_project
        session = AuthorizedSession(credentials)
        image = fetch_image(request.get("image_url"))
        prompt = base_prompt(request)
        text = prompt + ("\n添付は商品画像です。" if image else "\n商品画像はありません。商品名と寸法から形を決めてください。")
        with tempfile.TemporaryDirectory() as work:
            built = None
            while result["ai"]["calls"] < MAX_AI_CALLS:
                answer, usage, seconds = ask_gemini(session, project, text, image)
                result["ai"]["calls"] += 1
                result["ai"]["seconds"] += seconds
                result["ai"]["input_tokens"] += usage["total_input_tokens"]
                result["ai"]["output_tokens"] += usage["total_output_tokens"] + usage["total_thought_tokens"]
                result["notes"] = str(answer.get("notes", ""))[:200]
                code = str(answer.get("code", ""))
                built = build(code, request, work)
                result["checks"], result["error"] = built["checks"], built.get("error")
                store.write("model.py", code.encode("utf-8"), "text/x-python")
                print(f"AI {result['ai']['calls']} 回目 {seconds}秒: {'合格' if built['ok'] else '不合格 ' + str(built.get('error'))[:200]}", flush=True)
                if built["ok"]:
                    break
                text = prompt + f"\n# 修正\n下のコードは検査に通りませんでした。理由を直したコード全文を返してください。\n```python\n{code}\n```\n理由:\n{built.get('error')}"
            if built and built["ok"]:
                glb = os.path.join(work, f"{request['model_key']}.glb")
                for view in ("front", "side"):
                    png = os.path.join(work, f"{view}.png")
                    rendered = run("render.py", glb, png, view, timeout=300)
                    if rendered.returncode != 0 or not os.path.exists(png):
                        raise RuntimeError("確認用の画像を描けませんでした: " + (rendered.stderr or rendered.stdout)[-400:])
                    with open(png, "rb") as file:
                        store.write(f"{view}.png", file.read(), "image/png")
                with open(glb, "rb") as file:
                    store.write("model.glb", file.read(), "model/gltf-binary")
                result.update(status="succeeded", error=None, stats=built["stats"])
    except Exception as error:  # 失敗も result.json に残して、依頼した側が理由を読めるようにする
        result["error"] = f"{type(error).__name__}: {error}"[:1000]
    store.write("result.json", json.dumps(result, ensure_ascii=False, indent=1).encode("utf-8"), "application/json")
    print("RESULT", result["status"], result["error"] or "", flush=True)


if __name__ == "__main__":
    main()
