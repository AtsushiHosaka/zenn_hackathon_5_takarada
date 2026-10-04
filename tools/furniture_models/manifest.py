"""build_report.json から frontend 用の manifest.json を作る (通常のPythonで実行)。"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "frontend", "public", "models", "furniture", "manifest.json")

CATEGORY = {
    "sofa": "sofa", "bed_cover": "bed_cover", "bed": "bed", "futon": "bed", "table_low": "table",
    "table_dining": "table", "side_table": "side_table", "desk_lamp": "desk_lamp", "desk": "desk",
    "chair": "chair", "stool": "chair", "bookshelf": "shelf", "shelf": "shelf", "wardrobe": "storage",
    "chest": "storage", "tv_stand": "storage", "wall_shelf": "wall_shelf", "display_case": "display_case",
    "display_rack": "display_case", "display_stand": "display_stand", "acrylic": "acrylic_stand_case",
    "curtain": "curtain", "rug": "rug", "cushion": "cushion", "tapestry": "tapestry", "floor_lamp": "floor_lamp",
    "led": "led", "candle": "candle", "plant": "plant", "small_plant": "small_plant",
    "wall_planter": "wall_planter", "wall_mirror": "wall_mirror", "wall_art": "wall_art", "monitor": "monitor",
}
# モックカタログの商品ID・既存家具ID → モデル
PRODUCTS = {
    "bed-1": "bed_single", "desk-1": "desk_wood", "shelf-1": "bookshelf",
    "101": "bed_cover__101", "201": "bed_cover__201", "301": "bed_cover__301",
    "102": "curtain_pair__102", "202": "curtain_pair__202",
    "115": "curtain_sheer__115", "302": "curtain_sheer__302", "901": "curtain_sheer__901",
    "103": "rug_rect__103", "203": "rug_rect__203", "303": "rug_wave",
    "111": "rug_round__111", "211": "rug_round__211", "311": "rug_round__311",
    "107": "cushion__107", "207": "cushion__207", "307": "cushion__307",
    "104": "wall_shelf", "114": "tapestry", "105": "floor_lamp", "112": "floor_lamp_slim",
    "205": "floor_lamp_rattan", "212": "floor_lamp_tripod", "305": "floor_lamp_ball", "312": "floor_lamp_pleated",
    "106": "display_case", "113": "display_rack_open", "108": "acrylic_stand_case", "204": "wall_planter",
    "214": "wall_art", "206": "plant_monstera", "213": "plant_eucalyptus", "208": "small_plant",
    "304": "wall_mirror", "306": "side_table", "308": "candle", "902": "desk_lamp_clip",
}


def category(name):
    for prefix in sorted(CATEGORY, key=len, reverse=True):
        if name.startswith(prefix):
            return CATEGORY[prefix]
    raise KeyError(name)


report = json.load(open(os.path.join(HERE, "build_report.json")))
models = []
for r in sorted(report, key=lambda r: r["file"]):
    name = r["file"][:-4]
    base, _, variant = name.partition("__")
    models.append({
        "id": name, "url": f"/models/furniture/{r['file']}", "category": category(base), "shape": base,
        "variant": variant or None, "size": [round(v, 3) for v in r["target"]], "triangles": r["tris"],
        "materials": r["materials"],
    })
ids = {m["id"] for m in models}
missing = [p for p, mid in PRODUCTS.items() if mid not in ids]
assert not missing, missing
json.dump({"unit": "meter", "axes": "+Y up, +Z front, origin bottom center", "models": models,
           "products": PRODUCTS}, open(OUT, "w"), ensure_ascii=False, indent=1)
print(len(models), "models,", len(PRODUCTS), "products ->", OUT)
