"""使い方: Blender -b --python build.py -- [出力先] [ファイル名...]"""
import importlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import lib  # noqa: E402

MODULES = ["models_seating", "models_beds", "models_tables", "models_storage",
           "models_textiles", "models_lights", "models_plants", "models_decor",
           "models_ext_storage", "models_ext_seating", "models_ext_bedroom", "models_ext_appliances",
           "models_ext_goods"]
# 並行して作業するときは、読み込むモジュールと書き出し記録を分けられる
if os.environ.get("FURNITURE_MODULES"):
    MODULES = os.environ["FURNITURE_MODULES"].split(",")
for name in MODULES:
    if os.path.exists(os.path.join(HERE, name + ".py")):
        importlib.import_module(name)

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out_dir = os.path.abspath(argv[0]) if argv else os.path.join(HERE, "..", "..", "output", "furniture_models", "furniture")
only = set(argv[1:])
os.makedirs(out_dir, exist_ok=True)

report_path = os.environ.get("FURNITURE_BUILD_REPORT") or os.path.join(HERE, "build_report.json")
# 一部だけ再生成する場合も、ほかのモデルのカタログ情報を残す。
previous = json.load(open(report_path)) if only and os.path.exists(report_path) else []
report = {item["file"]: item for item in previous}
failed = []
output_names = {
    file if not suffix else file.replace(".glb", f"__{suffix}.glb")
    for file, (_, _, variants) in lib.ASSETS.items()
    for suffix in [""] + list(variants)
}
unknown = only - output_names
if unknown:
    raise ValueError(f"Unknown model files: {sorted(unknown)}")
for file, (fn, size, variants) in lib.ASSETS.items():
    for suffix, opts in [("", {})] + list(variants.items()):
        out_name = file if not suffix else file.replace(".glb", f"__{suffix}.glb")
        if only and file not in only and out_name not in only:
            continue
        try:
            model = fn(**opts)
            model.name = out_name[:-4]
            stats = model.finish(opts.get("size", size), os.path.join(out_dir, out_name))
            stats["file"] = out_name
            stats["target"] = opts.get("size", size)
            stats["bytes"] = os.path.getsize(os.path.join(out_dir, out_name))
            report[out_name] = stats
            print(f"OK {out_name} tris={stats['tris']} kb={stats['bytes'] // 1024} mats={stats['materials']}")
        except Exception as exc:  # 1件の失敗で全体を止めない
            import traceback
            traceback.print_exc()
            failed.append(out_name)
            print(f"FAIL {out_name}: {exc}")

with open(report_path, "w") as fp:
    json.dump(sorted(report.values(), key=lambda item: item["file"]), fp, ensure_ascii=False, indent=1)
print("FAILED:", failed)
if failed:
    sys.exit(1)
