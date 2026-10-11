"""AI が書いたモデル定義 1 つを、検査してから組み立てて GLB にする。別プロセスで動かす (generate.py が呼ぶ)。

使い方: python build.py <定義.py> <モデルID> <幅> <高さ> <奥行き> <出力先のディレクトリ>
結果は標準出力の最後の行に JSON で出す: {"ok": true/false, "checks": [...], "stats": {...}, "error": "..."}
"""
import json
import os
import sys
import traceback

import bpy  # noqa: F401  bmesh・mathutils は bpy を読み込んだ後に使える

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))  # lib.py・palette.py
sys.path.insert(0, HERE)

import checks  # noqa: E402
import lib  # noqa: E402


def main():
    path, model_key = sys.argv[1], sys.argv[2]
    target = tuple(float(value) for value in sys.argv[3:6])
    out_dir = sys.argv[6]
    results = []
    source = open(path, encoding="utf-8").read()
    reason = checks.check_source(source)
    results.append(("source", reason is None, reason or "許可された書き方だけを使っています"))
    if reason:
        return {"ok": False, "checks": results, "error": reason}

    lib.ASSETS.clear()
    try:
        exec(compile(source, "model.py", "exec"), {"__name__": "generated"})  # 検査済みのコードだけを実行する
    except Exception:
        return {"ok": False, "checks": results, "error": "定義の読み込みでエラー:\n" + traceback.format_exc()[-1500:]}
    file = f"{model_key}.glb"
    if list(lib.ASSETS) != [file]:
        return {"ok": False, "checks": results, "error": f'@asset("{file}", ...) を付けた関数をちょうど 1 つ定義してください (見つかったもの: {list(lib.ASSETS)})'}
    fn, size, _variants = lib.ASSETS[file]
    if any(abs(a - b) > 1e-6 for a, b in zip(size, target)):
        return {"ok": False, "checks": results, "error": f"@asset の寸法は {target} にしてください (書かれていた値: {tuple(size)})"}

    try:
        model = fn()
        model.name = model_key
        results += checks.check_parts(model.parts)
        results += checks.check_materials(model.mats)
        stats = model.finish(target, os.path.join(out_dir, file))
    except Exception:
        return {"ok": False, "checks": results, "error": "組み立てでエラー:\n" + traceback.format_exc()[-1500:]}
    size_bytes = os.path.getsize(os.path.join(out_dir, file))
    results += checks.check_output(stats["tris"], size_bytes)
    failed = [detail for _, ok, detail in results if not ok]
    return {
        "ok": not failed, "checks": results, "error": " / ".join(failed) or None,
        "stats": {"triangles": stats["tris"], "materials": stats["materials"], "bytes": size_bytes, "sha256": stats["sha256"],
                  "size": {"w": target[0], "h": target[1], "d": target[2]}, "built_size": [round(value, 4) for value in stats["actual"]]},
    }


if __name__ == "__main__":
    result = main()
    result["checks"] = [{"name": name, "ok": bool(ok), "detail": detail} for name, ok, detail in result["checks"]]
    print("RESULT " + json.dumps(result, ensure_ascii=False))
