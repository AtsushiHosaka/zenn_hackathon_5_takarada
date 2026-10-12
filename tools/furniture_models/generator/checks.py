"""AI が書いたモデル定義の検査。実行前 (ソース) と、組み立て後 (部品・素材・出来上がり) に分ける。

検査は (名前, 合否, 説明) の一覧で返す。1 つでも不合格なら、そのモデルは採用の候補にしない。
"""
import ast

# 許す import。これ以外を読み込むコードは実行しない (ファイル・通信・プロセスに触れさせない)
ALLOWED_IMPORTS = {"math"}
ALLOWED_FROM = {"lib": {"Model", "asset"}}
ALLOWED_IMPORT_AS = {"palette": "P"}
# 呼べない名前。属性・名前とも、__ で始まるものも使えない
BANNED_NAMES = {"open", "exec", "eval", "compile", "globals", "locals", "getattr", "setattr", "delattr", "vars", "input",
                "breakpoint", "bpy", "bmesh", "os", "sys", "subprocess", "importlib"}
MAX_SOURCE_BYTES = 20_000

# 部位 (素材) の名前。既存モデルで使っている名前のうち、家具に使うものだけ
ALLOWED_MATERIALS = {
    "tint", "wood", "wood_dark", "metal", "plastic", "glass", "acrylic", "light", "fabric", "fabric_back", "trim", "cushion",
    "leaf", "stem", "pot", "soil", "paper", "screen", "mirror", "frame", "knob", "cord", "rubber", "wheel", "stone", "weave",
    "rattan", "accent", "base", "handle", "mattress", "mattress_side", "pillow",
}
# 画面で色を変えられる部位。どれか 1 つは要る (backend の Furniture3DModel::PRIMARY_COLOR_KEYS と同じ並び)
RECOLORABLE_MATERIALS = ["tint", "wood", "fabric", "rattan", "weave", "leaf", "pot", "metal"]
# 光ってよい部位と、その明るさの上限 (既存モデルは 1.5〜2.5)
EMISSIVE_MATERIALS = {"light"}
MAX_EMISSION_STRENGTH = 2.5
# 透けてよい部位
TRANSPARENT_MATERIALS = {"glass", "acrylic"}
# 重さの上限。既存 301 モデルの 9 割は三角形 6,420 以下・225KB 以下
MAX_TRIANGLES = 8_000
MAX_BYTES = 350_000
MAX_PARTS = 120
# 部品どうしがこの距離 (m) 以内なら、つながっているとみなす
CONTACT_MARGIN = 0.004


def check_source(source):
    """実行前の検査。合格なら None、不合格なら理由の文字列を返す。"""
    if len(source.encode("utf-8")) > MAX_SOURCE_BYTES:
        return f"コードが長すぎます ({len(source.encode('utf-8'))} バイト。上限 {MAX_SOURCE_BYTES})"
    try:
        tree = ast.parse(source)
    except SyntaxError as error:
        return f"構文エラー: {error}"
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name in ALLOWED_IMPORTS and alias.asname is None:
                    continue
                if alias.name in ALLOWED_IMPORT_AS and ALLOWED_IMPORT_AS[alias.name] == alias.asname:
                    continue
                return f"許可されていない import: {alias.name}"
        elif isinstance(node, ast.ImportFrom):
            names = ALLOWED_FROM.get(node.module)
            if names is None or node.level or any(alias.name not in names or alias.asname for alias in node.names):
                return f"許可されていない import: from {node.module}"
        elif isinstance(node, ast.Name) and (node.id in BANNED_NAMES or node.id.startswith("__")):
            return f"使えない名前: {node.id}"
        elif isinstance(node, ast.Attribute) and node.attr.startswith("__"):
            return f"使えない属性: {node.attr}"
        elif isinstance(node, (ast.Global, ast.Nonlocal, ast.AsyncFunctionDef, ast.ClassDef, ast.With, ast.AsyncWith, ast.Try)):
            return f"使えない構文: {type(node).__name__}"
    return None


def check_parts(parts):
    """組み立て直後 (結合の前) の部品の検査。parts は Blender のオブジェクトの一覧。"""
    from mathutils import Vector

    results = []
    results.append(("parts", 0 < len(parts) <= MAX_PARTS, f"部品 {len(parts)} 個 (上限 {MAX_PARTS})"))
    if not parts:
        return results

    # 部品ごとの外接箱 (モディファイアを反映した形で測る)
    import bpy
    graph = bpy.context.evaluated_depsgraph_get()
    boxes = []
    for part in parts:
        evaluated = part.evaluated_get(graph)
        corners = [evaluated.matrix_world @ Vector(corner) for corner in evaluated.bound_box]
        boxes.append((part.name, [min(c[i] for c in corners) for i in range(3)], [max(c[i] for c in corners) for i in range(3)]))

    # 外接箱が触れている部品どうしをつなぎ、全体が 1 つの塊になっているかを見る (浮いた部品・離れた部品を落とす)
    parent = list(range(len(boxes)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i, (_, lo_a, hi_a) in enumerate(boxes):
        for j in range(i + 1, len(boxes)):
            _, lo_b, hi_b = boxes[j]
            if all(lo_a[k] <= hi_b[k] + CONTACT_MARGIN and lo_b[k] <= hi_a[k] + CONTACT_MARGIN for k in range(3)):
                parent[find(i)] = find(j)
    groups = {}
    for i, (name, _, _) in enumerate(boxes):
        groups.setdefault(find(i), []).append(name)
    largest = max(groups.values(), key=len)
    loose = sorted({name for group in groups.values() if group is not largest for name in group})
    results.append(("connected", len(groups) == 1, "すべての部品がつながっています" if len(groups) == 1 else f"離れている部品: {', '.join(loose[:8])}"))
    return results


def check_materials(materials):
    """素材の検査。materials は Model.mats (名前 → Blender の素材)。"""
    results = []
    names = sorted(materials)
    unknown = [name for name in names if name not in ALLOWED_MATERIALS]
    results.append(("material_names", not unknown, f"部位: {', '.join(names)}" if not unknown else f"使えない部位の名前: {', '.join(unknown)} (使える名前: {', '.join(sorted(ALLOWED_MATERIALS))})"))
    recolorable = [name for name in RECOLORABLE_MATERIALS if name in materials]
    results.append(("recolorable", bool(recolorable), f"色を変える部位: {recolorable[0]}" if recolorable else f"色を変えられる部位がありません ({', '.join(RECOLORABLE_MATERIALS)} のどれかが要ります)"))

    glowing, transparent = [], []
    for name, material in materials.items():
        shader = material.node_tree.nodes.get("Principled BSDF") if material.node_tree else None
        if shader is None:
            continue
        strength = shader.inputs["Emission Strength"].default_value
        color = shader.inputs["Emission Color"].default_value
        if strength > 0 and max(color[0], color[1], color[2]) > 0.001 and (name not in EMISSIVE_MATERIALS or strength > MAX_EMISSION_STRENGTH):
            glowing.append(f"{name} (強さ {strength:.1f})")
        if shader.inputs["Alpha"].default_value < 0.999 and name not in TRANSPARENT_MATERIALS:
            transparent.append(name)
    results.append(("emission", not glowing, "光る部位は light だけです" if not glowing else f"light 以外が光っている、または明るすぎます (上限 {MAX_EMISSION_STRENGTH}): {', '.join(glowing)}"))
    results.append(("transparency", not transparent, "透ける部位は glass・acrylic だけです" if not transparent else f"glass・acrylic 以外が透けています: {', '.join(transparent)}"))
    return results


def check_output(triangles, size_bytes):
    """書き出した GLB の検査。"""
    return [
        ("triangles", triangles <= MAX_TRIANGLES, f"三角形 {triangles} (上限 {MAX_TRIANGLES})"),
        ("file_size", size_bytes <= MAX_BYTES, f"ファイル {size_bytes // 1024}KB (上限 {MAX_BYTES // 1024}KB)"),
    ]
