"""使い方: Blender -b --python build.py -- [出力先] [ファイル名...]"""
import importlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import lib  # noqa: E402

MODULES = ["models_seating", "models_beds", "models_tables", "models_storage",
           "models_textiles", "models_lights", "models_plants", "models_decor"]
for name in MODULES:
    if os.path.exists(os.path.join(HERE, name + ".py")):
        importlib.import_module(name)

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out_dir = os.path.abspath(argv[0]) if argv else os.path.join(HERE, "..", "..", "frontend", "public", "models", "furniture")
only = set(argv[1:])
os.makedirs(out_dir, exist_ok=True)

report = []
failed = []
for file, (fn, size, variants) in lib.ASSETS.items():
    if only and file not in only:
        continue
    for suffix, opts in [("", {})] + list(variants.items()):
        out_name = file if not suffix else file.replace(".glb", f"__{suffix}.glb")
        try:
            model = fn(**opts)
            model.name = out_name[:-4]
            stats = model.finish(opts.get("size", size), os.path.join(out_dir, out_name))
            stats["file"] = out_name
            stats["target"] = opts.get("size", size)
            stats["bytes"] = os.path.getsize(os.path.join(out_dir, out_name))
            report.append(stats)
            print(f"OK {out_name} tris={stats['tris']} kb={stats['bytes'] // 1024} mats={stats['materials']}")
        except Exception as exc:  # 1件の失敗で全体を止めない
            import traceback
            traceback.print_exc()
            failed.append(out_name)
            print(f"FAIL {out_name}: {exc}")

with open(os.path.join(HERE, "build_report.json"), "w") as fp:
    json.dump(report, fp, ensure_ascii=False, indent=1)
print("FAILED:", failed)
