"""GLB実測値とbuild_report.jsonからDB登録用カタログを作る。通常のPythonで実行。"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent

CATEGORY = {
    "sofa": "sofa", "bed_cover": "bed_cover", "bed": "bed", "futon": "bed", "table_low": "table",
    "table_dining": "table", "side_table": "side_table", "desk_lamp": "desk_lamp", "desk": "desk",
    "chair": "chair", "stool": "chair", "bookshelf": "shelf", "shelf": "shelf", "wardrobe": "storage",
    "chest": "storage", "tv_stand": "storage", "wall_shelf": "wall_shelf", "display_case": "display_case",
    "display_rack": "display_case", "display_stand": "display_stand", "acrylic": "acrylic_stand_case",
    "curtain": "curtain", "rug": "rug", "cushion": "cushion", "tapestry": "tapestry", "floor_lamp": "floor_lamp",
    "led": "led", "candle": "candle", "plant": "plant", "small_plant": "small_plant",
    "wall_planter": "wall_planter", "wall_mirror": "wall_mirror", "wall_art": "wall_art", "monitor": "monitor",
    # 2026-10-04 追加分
    "ottoman": "ottoman", "bench": "bench", "beanbag": "beanbag", "floor_chair": "chair", "kotatsu": "table",
    "nightstand": "side_table", "console_table": "table", "wagon": "storage", "hanger_rack": "storage",
    "ladder_shelf": "shelf", "storage_basket": "storage_box", "pegboard": "pegboard", "dresser": "dresser",
    "mirror_stand": "floor_mirror", "mirror_arch": "wall_mirror", "table_lamp": "table_lamp",
    "pendant_light": "pendant_light", "tv": "tv", "plant_stand": "plant_stand", "vase": "vase",
    "wall_clock": "wall_clock", "photo_frame": "photo_frame", "plush": "plush", "blanket": "blanket",
    "room_divider": "room_divider", "trash_bin": "trash_bin",
}
NAMES = {
    "sofa_1seat": "1人掛けソファ", "sofa_2seat": "2人掛けソファ", "sofa_3seat": "3人掛けソファ",
    "sofa_low": "ローソファ", "sofa_l_left": "L字ソファ（正面から見て左カウチ）",
    "sofa_l_right": "L字ソファ（正面から見て右カウチ）", "sofa_bed_open": "展開したソファベッド",
    "bed_single": "シングルベッド", "bed_semidouble": "セミダブルベッド", "bed_double": "ダブルベッド",
    "bed_loft": "ロフトベッド", "futon_floor": "床敷き布団", "bed_cover": "ベッドカバー",
    "table_low_rect": "長方形ローテーブル", "table_low_round": "円形ローテーブル",
    "table_dining_rect": "長方形ダイニングテーブル", "table_dining_round": "円形ダイニングテーブル",
    "desk_wood": "木製デスク", "desk_wide": "ワイドデスク", "desk_l_left": "L字デスク（正面から見て左）",
    "desk_fold": "折り畳みデスク（使用状態）", "side_table": "円形サイドテーブル",
    "bookshelf": "本棚", "shelf_low": "低いオープン棚", "shelf_cube": "キューブ収納",
    "wardrobe": "ワードローブ", "chest_drawers": "チェスト", "tv_stand": "テレビ台",
    "chair_dining": "木製ダイニングチェア", "chair_office": "デスクチェア", "stool_round": "円形スツール",
    "curtain_pair": "両開きカーテン", "curtain_sheer": "レースカーテン", "rug_rect": "長方形ラグ",
    "rug_round": "円形ラグ", "rug_wave": "ウェーブラグ", "cushion": "クッション", "tapestry": "タペストリー",
    "wall_shelf": "壁付け3段棚", "display_case": "コレクションケース", "acrylic_stand_case": "卓上ひな壇",
    "display_rack_open": "オープンディスプレイラック", "display_stand_floor": "床置き3段ディスプレイ棚",
    "floor_lamp": "シェード付きフロアライト", "floor_lamp_slim": "スリムフロアライト",
    "floor_lamp_rattan": "ラタン調フロアライト", "floor_lamp_tripod": "三脚フロアライト",
    "floor_lamp_ball": "ボール型フロアライト", "floor_lamp_pleated": "プリーツシェードフロアライト",
    "desk_lamp_clip": "クリップライト", "led_strip_segment": "直線LEDテープ", "candle": "キャンドル",
    "plant_monstera": "モンステラ", "plant_eucalyptus": "ユーカリ", "small_plant": "卓上ミニ植物",
    "wall_planter": "壁掛けグリーン", "wall_mirror": "ウェーブミラー", "wall_art": "額入りアート",
    "monitor": "デスク上モニター",
    "ottoman_round": "丸型オットマン", "bench_wood": "木製ベンチ", "chair_lounge": "ラウンジチェア",
    "beanbag": "ビーズクッション", "floor_chair": "座椅子", "kotatsu": "こたつ（掛け布団付き）",
    "nightstand": "ナイトテーブル", "console_table": "コンソールテーブル", "side_table_c": "コの字サイドテーブル",
    "wagon_cart": "3段ワゴン", "hanger_rack": "ハンガーラック", "ladder_shelf": "ラダーシェルフ",
    "storage_basket": "ラタン調収納バスケット", "pegboard": "有孔ボード", "dresser": "ミラー付きドレッサー",
    "mirror_stand": "スタンドミラー", "mirror_arch": "アーチ型ウォールミラー",
    "table_lamp": "マッシュルーム型テーブルランプ", "pendant_light": "ペンダントライト", "tv": "43型テレビ",
    "plant_fiddle": "ウンベラータ", "plant_olive": "オリーブの木", "plant_stand": "2段フラワースタンド",
    "vase_tulip": "花瓶とチューリップ", "wall_clock": "壁掛け時計", "photo_frame": "卓上フォトフレーム",
    "plush_bear": "くまのぬいぐるみ", "blanket_folded": "たたんだブランケット",
    "room_divider": "3連パーテーション", "trash_bin": "ゴミ箱",
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


IDENTITY = [[1 if row == col else 0 for col in range(4)] for row in range(4)]


def multiply(left, right):
    return [[sum(left[row][i] * right[i][col] for i in range(4)) for col in range(4)] for row in range(4)]


def transform(node):
    if "matrix" in node:
        return [[node["matrix"][col * 4 + row] for col in range(4)] for row in range(4)]
    x, y, z, w = node.get("rotation", [0, 0, 0, 1])
    scale = node.get("scale", [1, 1, 1])
    translation = node.get("translation", [0, 0, 0])
    matrix = [
        [1 - 2 * (y*y + z*z), 2 * (x*y - z*w), 2 * (x*z + y*w)],
        [2 * (x*y + z*w), 1 - 2 * (x*x + z*z), 2 * (y*z - x*w)],
        [2 * (x*z - y*w), 2 * (y*z + x*w), 1 - 2 * (x*x + y*y)],
    ]
    return [[matrix[row][col] * scale[col] for col in range(3)] + [translation[row]] for row in range(3)] + [[0, 0, 0, 1]]


def measure_glb(path):
    """頂点とsceneの変換から、書き出し後の幅・高さ・奥行きを測る。"""
    data = path.read_bytes()
    if len(data) < 20 or struct.unpack_from("<4sII", data) != (b"glTF", 2, len(data)):
        raise ValueError(f"Invalid GLB header: {path}")
    chunks = {}
    offset = 12
    while offset < len(data):
        length, kind = struct.unpack_from("<I4s", data, offset)
        offset += 8
        if length % 4 or offset + length > len(data) or kind in chunks:
            raise ValueError(f"Invalid GLB chunk: {path}")
        chunks[kind] = data[offset:offset + length]
        offset += length
    doc = json.loads(chunks[b"JSON"])
    binary = chunks[b"BIN\x00"]
    if doc["asset"]["version"] != "2.0" or len(doc.get("buffers", [])) != 1:
        raise ValueError(f"Expected self-contained glTF 2.0: {path}")
    if doc["buffers"][0].get("uri") or any(image.get("uri") for image in doc.get("images", [])):
        raise ValueError(f"External resources must be embedded: {path}")
    if doc.get("skins") or doc.get("animations"):
        raise ValueError(f"Expected a static furniture model: {path}")

    minimum, maximum = [math.inf] * 3, [-math.inf] * 3
    triangles = 0

    def visit(index, parent, ancestors):
        nonlocal triangles
        if index in ancestors:
            raise ValueError(f"Cyclic scene graph: {path}")
        node = doc["nodes"][index]
        world = multiply(parent, transform(node))
        if "mesh" in node:
            for primitive in doc["meshes"][node["mesh"]]["primitives"]:
                accessor = doc["accessors"][primitive["attributes"]["POSITION"]]
                if accessor["componentType"] != 5126 or accessor["type"] != "VEC3" or "sparse" in accessor:
                    raise ValueError(f"Expected float VEC3 positions: {path}")
                view = doc["bufferViews"][accessor["bufferView"]]
                if view.get("buffer", 0) != 0:
                    raise ValueError(f"Expected embedded positions: {path}")
                start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
                stride = view.get("byteStride", 12)
                for i in range(accessor["count"]):
                    vertex = (*struct.unpack_from("<fff", binary, start + i * stride), 1)
                    for axis in range(3):
                        value = sum(world[axis][col] * vertex[col] for col in range(4))
                        if not math.isfinite(value):
                            raise ValueError(f"Non-finite position: {path}")
                        minimum[axis] = min(minimum[axis], value)
                        maximum[axis] = max(maximum[axis], value)
                if primitive.get("mode", 4) != 4:
                    raise ValueError(f"Expected triangle meshes: {path}")
                count = doc["accessors"][primitive["indices"]]["count"] if "indices" in primitive else accessor["count"]
                if count % 3:
                    raise ValueError(f"Incomplete triangle mesh: {path}")
                triangles += count // 3
        for child in node.get("children", []):
            visit(child, world, ancestors | {index})

    for root in doc["scenes"][doc.get("scene", 0)]["nodes"]:
        visit(root, IDENTITY, set())
    size = [maximum[i] - minimum[i] for i in range(3)]
    if not all(math.isfinite(value) and value > 0 for value in size):
        raise ValueError(f"Expected positive dimensions: {path}")
    origin = [(minimum[0] + maximum[0]) / 2, minimum[1], (minimum[2] + maximum[2]) / 2]
    if any(abs(value) > 0.00001 for value in origin):
        raise ValueError(f"Expected bottom-center origin: {path}: {origin}")
    return {"size": [round(value, 6) for value in size], "triangles": triangles,
            "materials": [material["name"] for material in doc.get("materials", [])],
            "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--models-dir", type=Path, default=ROOT / "output/furniture_models/furniture")
    parser.add_argument("--report", type=Path, default=HERE / "build_report.json")
    parser.add_argument("--output", type=Path, default=ROOT / "backend/db/furniture_models.json")
    args = parser.parse_args()
    report = json.loads(args.report.read_text())
    models = []
    ids = set()
    for item in sorted(report, key=lambda row: row["file"]):
        filename = item["file"]
        if Path(filename).name != filename or not filename.endswith(".glb"):
            raise ValueError(f"Invalid model filename: {filename}")
        model_id = filename[:-4]
        if model_id in ids:
            raise ValueError(f"Duplicate model id: {model_id}")
        ids.add(model_id)
        base, _, variant = model_id.partition("__")
        stats = measure_glb(args.models_dir / filename)
        if item.get("sha256") != stats["sha256"]:
            raise ValueError(f"Build report SHA256 differs from exported file: {filename}")
        target = item["target"]
        if len(target) != 3 or any(not math.isfinite(value) or value <= 0 for value in target):
            raise ValueError(f"Invalid target dimensions: {filename}")
        if any(abs(actual - expected) > 0.00001 for actual, expected in zip(stats["size"], target)):
            raise ValueError(f"Exported size differs from target: {filename}: {stats['size']} vs {target}")
        if stats["triangles"] != item["tris"] or stats["materials"] != item["materials"]:
            raise ValueError(f"Build report differs from exported geometry/materials: {filename}")
        models.append({"id": model_id, "name": NAMES[base], "category": category(base), "shape": base,
                       "variant": variant or None, "format": "glb", "object_key": f"models/furniture/v1/{filename}", **stats})
    missing = [reference for reference, model_id in PRODUCTS.items() if model_id not in ids]
    if missing:
        raise ValueError(f"Missing models for bindings: {missing}")
    bindings = [{"kind": "existing" if reference in ("bed-1", "desk-1", "shelf-1") else "product",
                 "reference": reference, "model_id": model_id} for reference, model_id in sorted(PRODUCTS.items())]
    catalog = {"unit": "meter", "axes": "+Y up, +Z front, origin bottom center", "models": models, "bindings": bindings}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(catalog, ensure_ascii=False, indent=1) + "\n")
    print(f"{len(models)} models, {len(bindings)} bindings -> {args.output}")


if __name__ == "__main__":
    main()
