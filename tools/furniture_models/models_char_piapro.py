"""ピアプロキャラクターズの二次創作モデル (非商用・個人の範囲。ピアプロ・キャラクター・ライセンスに従う)。
公式イラストを写さず、よく知られた特徴 (色・髪形・服装) だけで独自にデフォルメした。
わざと粗いローポリ: 少ない分割、フラットシェーディング、ベベルなし、決まった種で頂点を少し揺らす。
正面 +Z。壁掛けは背面 -Z が平ら。"""
import math
import random

import bmesh
from lib import Model, asset
from mathutils import Matrix, Vector
from mathutils.geometry import convex_hull_2d, tessellate_polygon

# 初音ミクの色 (一般に知られた配色を元にした独自の近似値)
TEAL = "#39c5bb"
TEAL_DARK = "#1f8f8a"
SKIN = "#f6dccb"
GRAY = "#aeb4bc"
BLACK = "#33313b"
TIE_DARK = "#3a3a44"
MAGENTA = "#e0447f"
EYE = "#1d6f78"
WHITE = "#fbfaf8"
MOUTH = "#c9606e"


def mats(m):
    return {
        "hair": m.mat("hair", TEAL, rough=0.9),
        "skin": m.mat("skin", SKIN, rough=0.9),
        "top": m.mat("cloth_top", GRAY, rough=0.9),
        "tie": m.mat("tie", TEAL_DARK, rough=0.9),
        "skirt": m.mat("skirt", BLACK, rough=0.9),
        "trim": m.mat("trim", TEAL, rough=0.9),
        "boots": m.mat("boots", BLACK, rough=0.9),
        "hairtie": m.mat("hair_tie", TIE_DARK, rough=0.9),
        "pink": m.mat("hair_tie_accent", MAGENTA, rough=0.9),
        "eyes": m.mat("eyes", EYE, rough=0.9),
        "white": m.mat("eye_highlight", WHITE, rough=0.9),
        "mouth": m.mat("mouth", MOUTH, rough=0.9),
    }


# ---------- 粗い形状 ----------

def rough(m, ob, rnd, amt):
    """頂点を決まった乱数で揺らし、フラットシェーディングにする。amt は揺れの最大量 (m)。"""
    m.apply(ob)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)  # 球の極などの重なりを一つにする (穴を作らない)
    for v in bm.verts:
        v.co += Vector((rnd.uniform(-amt, amt), rnd.uniform(-amt, amt), rnd.uniform(-amt, amt)))
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.shade_flat()
    return ob


def lump(m, center, scale, mat, rnd, seg=7, rings=5, rot=None, jit=0.06, name="lump"):
    """ローポリの楕円体。"""
    ob = m.sphere(1, (0, 0, 0), mat, seg=seg, rings=rings, scale=scale, name=name)
    mt = Matrix.Translation(center)
    if rot is not None:
        mt = mt @ rot
    rough(m, ob, rnd, jit * min(scale))
    ob.data.transform(mt)
    return ob


def tube(m, path, mat, rnd, seg=6, jit=0.08, name="tube"):
    """path: [(x, y, z, 半径)]。先細りの筒 (端は閉じる)。"""
    bm = bmesh.new()
    pts = [Vector(p[:3]) for p in path]
    rings = []
    for k, p in enumerate(path):
        c = pts[k]
        t = (pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)]).normalized()
        ref = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
        side = t.cross(ref).normalized()
        up = side.cross(t).normalized()
        r = p[3]
        if r <= 1e-5:
            rings.append([bm.verts.new(c)])
            continue
        rings.append([bm.verts.new(c + r * (math.cos(math.tau * i / seg) * side + math.sin(math.tau * i / seg) * up))
                      for i in range(seg)])
    for lo, hi in zip(rings, rings[1:]):
        for i in range(seg):
            j = (i + 1) % seg
            if len(hi) == 1:
                bm.faces.new((lo[i], lo[j], hi[0]))
            elif len(lo) == 1:
                bm.faces.new((lo[0], hi[j], hi[i]))
            else:
                bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    if len(rings[0]) > 1:
        bm.faces.new(list(reversed(rings[0])))
    if len(rings[-1]) > 1:
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = m._obj(bm, mat, name)
    rmax = max(p[3] for p in path)
    rough(m, ob, rnd, jit * rmax)
    return ob


def cone(m, a, b, r1, r2, mat, rnd, seg=6, jit=0.06, name="cone"):
    ob = m.rod(a, b, r1, mat, seg=seg, r2=r2, name=name)
    rough(m, ob, rnd, jit * max(r1, r2))
    return ob


def poly(m, pts, z, t, mat, name="flat"):
    """正面図 (x, y) の多角形 (凹みも可) を z から +Z へ厚み t で押し出す。"""
    bm = bmesh.new()
    back = [bm.verts.new((x, y, z)) for x, y in pts]
    front = [bm.verts.new((x, y, z + t)) for x, y in pts]
    for tri in tessellate_polygon([[Vector((x, y, 0)) for x, y in pts]]):
        bm.faces.new([front[i] for i in tri])
        bm.faces.new([back[i] for i in reversed(tri)])
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((back[i], back[j], front[j], front[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = m._obj(bm, mat, name)
    ob.data.shade_flat()
    return ob


def ngon(cx, cy, rx, ry, n=6, rot=0.0):
    return [(cx + rx * math.cos(math.tau * i / n + rot), cy + ry * math.sin(math.tau * i / n + rot)) for i in range(n)]


# ---------- 立体の頭 ----------

def head3d(m, M, rnd, c, R, tails, zs=1.0):
    """デフォルメした頭。c: 中心, R: 半径, tails: 右側の房の経路 [(x, y, z, r)] (R 単位・c 基準)。
    zs: 奥行きの縮み (ダイカットクッション用)。"""
    c = Vector(c)
    # 髪の塊 (後頭部〜頭頂)
    lump(m, c + Vector((0, 0.1 * R, -0.12 * R * zs)), (1.05 * R, 1.02 * R, 1.0 * R * zs), M["hair"], rnd,
         seg=8, rings=6, name="hair_back")
    # 顔
    fc = c + Vector((0, -0.12 * R, 0.14 * R * zs))
    fr = (0.9 * R, 0.86 * R, 0.9 * R * zs)
    lump(m, fc, fr, M["skin"], rnd, seg=8, rings=6, jit=0.03, name="face")

    def on_face(dx, dy, out=0.0):
        """顔の楕円体の表面の点 (正面側)。"""
        u, v = dx / fr[0], dy / fr[1]
        w = math.sqrt(max(0.02, 1 - u * u - v * v))
        return fc + Vector((dx, dy, fr[2] * w + out))

    # 前髪: 額を覆う三角の房
    for i, dx in enumerate((-0.62, -0.32, 0.0, 0.3, 0.6)):
        top = on_face(dx * R * 0.9, 0.62 * R, 0.06 * R)
        tip = on_face(dx * R * 1.05, (0.05 if i % 2 == 0 else 0.18) * R, 0.06 * R)
        cone(m, top, tip, 0.26 * R, 0.03 * R, M["hair"], rnd, seg=5, jit=0.15, name="bang")
    # 横の髪 (顔の両脇に下がる房)
    for sx in (-1, 1):
        a = on_face(sx * 0.7 * R, 0.45 * R, 0.0)
        b = c + Vector((sx * 0.86 * R, -0.95 * R, 0.25 * R * zs))
        cone(m, a, b, 0.2 * R, 0.05 * R, M["hair"], rnd, seg=5, jit=0.15, name="side_lock")
    # 目 (大きな縦長の目と白い光)
    for sx in (-1, 1):
        p = on_face(sx * 0.36 * R, -0.18 * R, -0.04 * R * zs)
        lump(m, p, (0.17 * R, 0.24 * R, 0.07 * R * zs), M["eyes"], rnd, seg=6, rings=4, jit=0.05, name="eye")
        q = on_face(sx * 0.31 * R, -0.08 * R, 0.0)
        lump(m, q, (0.06 * R, 0.06 * R, 0.04 * R * zs), M["white"], rnd, seg=5, rings=3, jit=0.0,
             name="eye_light")
    lump(m, on_face(0, -0.5 * R, -0.02 * R * zs), (0.08 * R, 0.04 * R, 0.04 * R * zs), M["mouth"], rnd, seg=5,
         rings=3, jit=0.0, name="mouth")
    # 結び目とツインテール
    for sx in (-1, 1):
        root = c + Vector((sx * 0.86 * R, 0.62 * R, -0.18 * R * zs))
        cone(m, root - Vector((sx * 0.12 * R, 0, 0)), root + Vector((sx * 0.2 * R, 0, 0)), 0.26 * R, 0.24 * R,
             M["hairtie"], rnd, seg=6, jit=0.08, name="hair_tie")
        cone(m, root + Vector((sx * 0.03 * R, 0.0, 0)), root + Vector((sx * 0.1 * R, 0.0, 0)), 0.28 * R, 0.27 * R,
             M["pink"], rnd, seg=6, jit=0.04, name="hair_tie_band")
        path = [(c.x + sx * x * R, c.y + y * R, c.z + z * R * zs, r * R) for x, y, z, r in tails]
        tube(m, path, M["hair"], rnd, seg=6, jit=0.1, name="twin_tail")


def body3d(m, M, rnd, s, sit):
    """胴・腕・脚。s: 縮尺 (立ち姿の胴の高さ基準)。sit=True は座り姿。"""
    if sit:
        hip = 0.03 * s
        skirt_b, skirt_t = 0.0 * s + 0.004 * s, 0.05 * s
        chest = 0.095 * s
    else:
        hip = 0.08 * s
        skirt_b, skirt_t = 0.072 * s, 0.105 * s
        chest = 0.14 * s
    top_b = skirt_t - 0.006 * s
    # 上衣 (グレーのノースリーブ)
    cone(m, (0, top_b, 0), (0, chest, 0), 0.03 * s, 0.024 * s, M["top"], rnd, seg=7, jit=0.06, name="top")
    # 首
    cone(m, (0, chest - 0.004 * s, 0), (0, chest + 0.012 * s, 0), 0.01 * s, 0.009 * s, M["skin"], rnd, seg=5,
         jit=0.0, name="neck")
    # ネクタイ (胸の前に下がる四角錐)
    zt = 0.021 * s  # 上衣の表面に沿わせる
    cone(m, (0, chest - 0.004 * s, zt), (0, chest - 0.032 * s, zt + 0.005 * s), 0.008 * s, 0.002 * s, M["tie"], rnd,
         seg=4, jit=0.05, name="tie")
    # スカート (黒) と青緑の縁
    cone(m, (0, skirt_b + 0.005 * s, 0), (0, skirt_t, 0), 0.05 * s, 0.03 * s, M["skirt"], rnd, seg=7, jit=0.04,
         name="skirt")
    cone(m, (0, skirt_b, 0), (0, skirt_b + 0.006 * s, 0), 0.052 * s, 0.051 * s, M["trim"], rnd, seg=7, jit=0.02,
         name="skirt_trim")
    for sx in (-1, 1):
        sh = Vector((sx * 0.03 * s, chest - 0.006 * s, 0))
        # 肩 (肌)、離れた袖 (グレー、青緑の縁)、手
        lump(m, sh, (0.011 * s, 0.011 * s, 0.011 * s), M["skin"], rnd, seg=6, rings=4, name="shoulder")
        if sit:
            hand = Vector((sx * 0.05 * s, 0.035 * s, 0.03 * s))
        else:
            hand = Vector((sx * 0.048 * s, chest - 0.06 * s, 0.008 * s))
        mid = sh.lerp(hand, 0.3)
        cone(m, mid, hand, 0.012 * s, 0.017 * s, M["top"], rnd, seg=6, jit=0.06, name="sleeve")
        cone(m, mid - (hand - mid).normalized() * 0.002 * s, mid + (hand - mid).normalized() * 0.005 * s,
             0.0135 * s, 0.0135 * s, M["trim"], rnd, seg=6, jit=0.02, name="sleeve_cuff")
        cone(m, sh, mid, 0.008 * s, 0.009 * s, M["skin"], rnd, seg=5, jit=0.0, name="upper_arm")
        lump(m, hand + (hand - mid).normalized() * 0.006 * s, (0.009 * s, 0.009 * s, 0.009 * s), M["skin"], rnd,
             seg=5, rings=4, name="hand")
        # 脚: 腿 (肌) と黒いブーツ、青緑の靴底
        if sit:
            k0 = Vector((sx * 0.02 * s, hip, 0.0))
            k1 = Vector((sx * 0.024 * s, 0.015 * s, 0.03 * s))
            foot = Vector((sx * 0.028 * s, 0.014 * s, 0.06 * s))
            cone(m, k0, k1, 0.016 * s, 0.015 * s, M["skin"], rnd, seg=6, jit=0.05, name="thigh")
            cone(m, k1 - Vector((0, 0, 0.004 * s)), foot, 0.016 * s, 0.017 * s, M["boots"], rnd, seg=6, jit=0.05,
                 name="boot")
            cone(m, foot, foot + Vector((0, 0, 0.006 * s)), 0.017 * s, 0.015 * s, M["trim"], rnd, seg=6, jit=0.03,
                 name="sole")
        else:
            k0 = Vector((sx * 0.018 * s, hip, 0))
            k1 = Vector((sx * 0.019 * s, 0.064 * s, 0))
            ank = Vector((sx * 0.019 * s, 0.012 * s, 0))
            cone(m, k0, k1, 0.014 * s, 0.013 * s, M["skin"], rnd, seg=6, jit=0.05, name="thigh")
            cone(m, k1, ank, 0.014 * s, 0.011 * s, M["boots"], rnd, seg=6, jit=0.05, name="boot")
            cone(m, ank, ank + Vector((0, -0.004 * s, 0.006 * s)), 0.012 * s, 0.012 * s, M["boots"], rnd, seg=6,
                 jit=0.03, name="boot_toe")
            m.box((0.022 * s, 0.006 * s, 0.032 * s), (sx * 0.019 * s, 0.003 * s, 0.004 * s), M["trim"], bevel=0.0,
                  name="sole")
            rough(m, m.parts[-1], rnd, 0.001 * s)


# ---------- ぬいぐるみ ----------

PLUSH_TAILS = [(0.95, 0.62, -0.2, 0.22), (1.25, 0.5, -0.28, 0.32), (1.42, 0.1, -0.32, 0.36),
               (1.46, -0.45, -0.3, 0.32), (1.38, -1.0, -0.24, 0.22), (1.3, -1.55, -0.18, 0.08), (1.26, -1.75, -0.16, 0.0)]


def _plush(name, k, seed):
    """座ったぬいぐるみ (ぬい)。k: 縮尺 (0.20×0.22×0.12 が 1)。"""
    m = Model(name)
    m.tol = 0.15
    rnd = random.Random(seed)
    M = mats(m)
    s = k
    body3d(m, M, rnd, s, sit=True)
    R = 0.058 * s
    head3d(m, M, rnd, (0, 0.152 * s, 0.0), R, PLUSH_TAILS, zs=0.8)
    return m


@asset("char_hatsune_miku_plush.glb", (0.20, 0.22, 0.12))
def char_hatsune_miku_plush(tint=None):
    return _plush("char_hatsune_miku_plush", 1.0, 39)


@asset("char_hatsune_miku_plush_big.glb", (0.40, 0.45, 0.25))
def char_hatsune_miku_plush_big(tint=None):
    return _plush("char_hatsune_miku_plush_big", 2.04, 39)


# ---------- フィギュア ----------

FIG_TAILS = [(0.95, 0.62, -0.2, 0.2), (1.3, 0.55, -0.3, 0.3), (1.5, 0.05, -0.4, 0.34), (1.55, -1.0, -0.5, 0.33),
             (1.5, -2.2, -0.55, 0.28), (1.38, -3.3, -0.5, 0.16), (1.3, -3.85, -0.45, 0.0)]


@asset("char_hatsune_miku_figure.glb", (0.12, 0.22, 0.10))
def char_hatsune_miku_figure(tint=None):
    """丸い台座に立つ小さなローポリのフィギュア。"""
    m = Model("char_hatsune_miku_figure")
    m.tol = 0.15
    rnd = random.Random(1)
    M = mats(m)
    base = m.mat("base", "#dfe6ea", rough=0.85)
    m.cyl(0.048, 0.01, (0, 0.005, 0), base, seg=8, name="base")
    m.parts[-1].data.shade_flat()
    s = 0.89
    start = len(m.parts)
    body3d(m, M, rnd, s, sit=False)
    R = 0.034
    head3d(m, M, rnd, (0, 0.152 * s + 0.03, 0.0), R, FIG_TAILS)
    for ob in m.parts[start:]:
        m.apply(ob)
        ob.data.transform(Matrix.Translation((0, 0.01, 0)))
    return m


# ---------- 平面の絵柄 (アクスタ・タペストリー) ----------

def miku_flat(m, M, rnd, ox, oy, S, z, dz, t, jit=0.012, spread=1.0):
    """正面図のデフォルメ初音ミク。足元が (ox, oy)、全高がおよそ S。z から dz ずつ層を重ねる。
    S は (横, 縦) の倍率でもよい。spread: ツインテールの横への広がり (1 が最大)。
    返り値: 輪郭に使う点の一覧。"""
    all_pts = []
    Sx, Sy = S if isinstance(S, tuple) else (S, S)

    def P(pts, layer, mat, name, j=jit):
        q = [(ox + (x + rnd.uniform(-j, j)) * Sx, oy + (y + rnd.uniform(-j, j)) * Sy) for x, y in pts]
        all_pts.extend(q)
        poly(m, q, z + layer * dz, t, mat, name=name)

    def mirror(pts):
        return [(-x, y) for x, y in reversed(pts)]

    tail = [(-0.27, 0.86), (-0.42, 0.82), (-0.5, 0.66), (-0.52, 0.42), (-0.48, 0.2), (-0.44, 0.05), (-0.36, 0.12),
            (-0.36, 0.36), (-0.34, 0.58), (-0.27, 0.74)]
    tail = [(-(0.27 + (-x - 0.27) * spread), y) for x, y in tail]
    for pts in (tail, mirror(tail)):
        P(pts, 0, M["hair"], "flat_tail")
    P(ngon(0, 0.71, 0.29, 0.28, n=8, rot=math.pi / 8), 0, M["hair"], "flat_hair_back")
    # 胴・腕・脚 (髪の後ろの層の上)
    P([(-0.13, 0.31), (0.13, 0.31), (0.11, 0.47), (-0.11, 0.47)], 1, M["top"], "flat_top")
    P([(-0.035, 0.44), (0.035, 0.44), (0.03, 0.5), (-0.03, 0.5)], 1, M["skin"], "flat_neck")
    P([(0.0, 0.46), (0.035, 0.44), (0.012, 0.33), (0.0, 0.31), (-0.012, 0.33), (-0.035, 0.44)], 2, M["tie"],
      "flat_tie", j=0.004)
    P([(-0.2, 0.2), (0.2, 0.2), (0.13, 0.33), (-0.13, 0.33)], 2, M["skirt"], "flat_skirt")
    P([(-0.205, 0.185), (0.205, 0.185), (0.2, 0.215), (-0.2, 0.215)], 3, M["trim"], "flat_skirt_trim", j=0.004)
    for sx in (-1, 1):
        def X(pts):
            return [(sx * x, y) for x, y in pts]
        P(X([(0.11, 0.39), (0.15, 0.36), (0.17, 0.46), (0.12, 0.47)]), 1, M["skin"], "flat_shoulder")
        P(X([(0.13, 0.38), (0.19, 0.39), (0.24, 0.24), (0.15, 0.23)]), 2, M["top"], "flat_sleeve")
        P(X([(0.13, 0.36), (0.19, 0.375), (0.185, 0.405), (0.125, 0.39)]), 3, M["trim"], "flat_cuff", j=0.004)
        P(X([(0.16, 0.235), (0.23, 0.245), (0.22, 0.2), (0.17, 0.195)]), 3, M["skin"], "flat_hand")
        P(X([(0.025, 0.2), (0.105, 0.2), (0.1, 0.16), (0.03, 0.16)]), 1, M["skin"], "flat_thigh")
        P(X([(0.03, 0.17), (0.1, 0.17), (0.095, 0.03), (0.035, 0.03)]), 2, M["boots"], "flat_boot")
        P(X([(0.025, 0.0), (0.11, 0.0), (0.105, 0.035), (0.03, 0.035)]), 3, M["trim"], "flat_sole", j=0.004)
    # 顔と前髪
    P([(-0.22, 0.66), (-0.2, 0.55), (-0.1, 0.48), (0.1, 0.48), (0.2, 0.55), (0.22, 0.66), (0.0, 0.74)], 4,
      M["skin"], "flat_face", j=0.006)
    bang = [(-0.29, 0.72), (-0.24, 0.58), (-0.17, 0.66), (-0.11, 0.6), (-0.04, 0.68), (0.03, 0.6), (0.1, 0.67),
            (0.17, 0.59), (0.24, 0.66), (0.29, 0.72), (0.25, 0.88), (0.0, 0.96), (-0.25, 0.88)]
    P(bang, 5, M["hair"], "flat_bangs", j=0.006)
    for sx in (-1, 1):
        P([(sx * 0.29, 0.74), (sx * 0.2, 0.68), (sx * 0.21, 0.44), (sx * 0.26, 0.4)], 5, M["hair"],
          "flat_side_lock", j=0.006)
        P(ngon(sx * 0.29, 0.85, 0.045, 0.06, n=5), 6, M["hairtie"], "flat_hair_tie", j=0.003)
        P(ngon(sx * 0.305, 0.85, 0.015, 0.03, n=4), 7, M["pink"], "flat_hair_tie_accent", j=0.002)
        P(ngon(sx * 0.095, 0.585, 0.045, 0.06, n=6, rot=math.pi / 2), 6, M["eyes"], "flat_eye", j=0.003)
        P(ngon(sx * 0.08, 0.605, 0.016, 0.016, n=4), 7, M["white"], "flat_eye_light", j=0.001)
    P([(-0.025, 0.52), (0.025, 0.52), (0.0, 0.5)], 6, M["mouth"], "flat_mouth", j=0.002)
    return all_pts


def note(m, mat, x, y, s, z, t, rnd, double=False):
    """音符 (玉・棒・旗) を平らな多角形で。"""
    def J(pts):
        return [(px + rnd.uniform(-0.04, 0.04) * s, py + rnd.uniform(-0.04, 0.04) * s) for px, py in pts]
    heads = [(x, y)] + ([(x + 0.55 * s, y + 0.12 * s)] if double else [])
    for hx, hy in heads:
        poly(m, J(ngon(hx, hy, 0.17 * s, 0.12 * s, n=6, rot=0.4)), z, t, mat, name="note_head")
        poly(m, J([(hx + 0.12 * s, hy), (hx + 0.17 * s, hy), (hx + 0.17 * s, hy + 0.75 * s),
                   (hx + 0.12 * s, hy + 0.75 * s)]), z, t, mat, name="note_stem")
    if double:
        x2 = x + 0.55 * s
        poly(m, J([(x + 0.12 * s, y + 0.62 * s), (x2 + 0.17 * s, y + 0.74 * s), (x2 + 0.17 * s, y + 0.87 * s),
                   (x + 0.12 * s, y + 0.75 * s)]), z, t, mat, name="note_beam")
    else:
        poly(m, J([(x + 0.17 * s, y + 0.75 * s), (x + 0.4 * s, y + 0.5 * s), (x + 0.38 * s, y + 0.42 * s),
                   (x + 0.17 * s, y + 0.58 * s)]), z, t, mat, name="note_flag")


# ---------- アクリルスタンド ----------

@asset("char_hatsune_miku_acrylic_stand.glb", (0.09, 0.15, 0.06))
def char_hatsune_miku_acrylic_stand(tint=None):
    m = Model("char_hatsune_miku_acrylic_stand")
    rnd = random.Random(7)
    M = mats(m)
    acr = m.mat("acrylic", "#e6eef6", rough=0.08, alpha=0.4)
    base_h = 0.006
    # 台座 (角を落とした八角形)
    oct_ = ngon(0, 0, 0.045, 0.03, n=8, rot=math.pi / 8)
    m.prism([(x / math.cos(math.pi / 8), z / math.cos(math.pi / 8)) for x, z in oct_], base_h, acr, plane="xz",
            offset=0.0, name="base")
    th = 0.003
    pts = miku_flat(m, M, rnd, 0, base_h + 0.004, (0.118, 0.14), th / 2, 0.0003, 0.0004, jit=0.01, spread=0.3)
    # 絵柄の外形に沿う板 (凸包を外へ広げる)
    hull = [pts[i] for i in convex_hull_2d(pts)]
    cx = sum(p[0] for p in hull) / len(hull)
    cy = sum(p[1] for p in hull) / len(hull)
    board = []
    for x, y in hull:
        d = Vector((x - cx, y - cy))
        q = Vector((x, y)) + d.normalized() * 0.004
        board.append((q.x, max(q.y, base_h - 0.004)))
    board = board[::-1] if sum(board[i][0] * board[(i + 1) % len(board)][1] - board[(i + 1) % len(board)][0] *
                               board[i][1] for i in range(len(board))) < 0 else board
    poly(m, board, -th / 2, th, acr, name="board")
    return m


# ---------- タペストリー ----------

@asset("char_hatsune_miku_tapestry_b2.glb", (0.515, 0.728, 0.015))
def char_hatsune_miku_tapestry_b2(tint=None):
    m = Model("char_hatsune_miku_tapestry_b2")
    rnd = random.Random(11)
    M = mats(m)
    fab = m.mat("fabric", "#e4f4f1", rough=0.95)
    deco = m.mat("fabric_pattern", "#b9e6e1", rough=0.95)
    rod = m.mat("rod", "#4a4652", rough=0.85)
    cord = m.mat("string", "#4a4652", rough=0.9)
    W, H, D = 0.515, 0.728, 0.015
    r = D / 2
    loop = 0.05
    top = H - loop - r
    bot = r
    cw = W - 0.03
    m.box((cw, top - bot, 0.002), (0, (top + bot) / 2, -0.004), fab, bevel=0.0, name="cloth")
    zf = -0.003
    # 背景の斜めの帯
    for k, (y0, y1) in enumerate(((0.12, 0.2), (0.42, 0.47))):
        poly(m, [(-cw / 2, y0), (cw / 2, y0 + 0.15), (cw / 2, y1 + 0.15), (-cw / 2, y1)], zf, 0.0008, deco,
             name="band")
    miku_flat(m, M, rnd, 0, bot + 0.04, (0.5, 0.54), zf + 0.0008, 0.0003, 0.0003, jit=0.01, spread=0.7)
    # 音符
    for x, y, s, dbl in ((-0.19, 0.53, 0.07, False), (0.14, 0.58, 0.06, True), (0.17, 0.27, 0.05, False),
                         (-0.2, 0.25, 0.045, True)):
        note(m, M["pink"] if dbl else M["hair"], x, y, s, zf + 0.0008, 0.0006, rnd, double=dbl)
    for y in (top, bot):
        m.cyl(r, W, (0, y, 0), rod, seg=6, axis="x", name="rod")
        m.parts[-1].data.shade_flat()
    peak = (0, H - 0.0015, 0)
    for sx in (-1, 1):
        m.rod((sx * (W / 2 - 0.012), top + r * 0.6, 0), peak, 0.0015, cord, seg=4, name="string")
    return m


# ---------- ダイカットクッション ----------

CUSHION_TAILS = [(0.9, 0.6, -0.1, 0.25), (1.12, 0.4, -0.12, 0.32), (1.22, -0.1, -0.12, 0.36),
                 (1.23, -0.9, -0.1, 0.35), (1.17, -1.7, -0.08, 0.28), (1.08, -2.35, -0.06, 0.12),
                 (1.04, -2.55, -0.05, 0.0)]


@asset("char_hatsune_miku_cushion.glb", (0.40, 0.45, 0.12))
def char_hatsune_miku_cushion(tint=None):
    """頭とツインテールの形のダイカットクッション。奥行きを潰した立体。"""
    m = Model("char_hatsune_miku_cushion")
    m.tol = 0.15
    rnd = random.Random(5)
    M = mats(m)
    R = 0.125
    head3d(m, M, rnd, (0, 0.45 - 1.15 * R, 0), R, CUSHION_TAILS, zs=0.36)
    return m
