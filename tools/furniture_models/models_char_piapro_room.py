"""初音ミクの部屋飾りグッズ (ポスター・タペストリー・等身大パネル・時計・マグなど)。
models_char_piapro と同じ方針: 非商用・個人の範囲 (ピアプロ・キャラクター・ライセンスに従う)、公式イラストを写さない、
わざと粗いローポリ (少ない分割・フラットシェーディング・ベベルなし・決まった種の揺らぎ)。文字・ロゴは入れない。
正面 +Z。壁掛けは背面 -Z が平ら。"""
import math
import random

import bmesh
import bpy
import models_char_piapro as cp
from lib import Model, asset, rot_matrix, rrect
from mathutils import Matrix, Vector
from mathutils.geometry import convex_hull_2d
from models_char_piapro import TEAL, mats, miku_flat, ngon, note, poly

PAPER = "#cdeeea"      # 淡い青緑の紙・布地
PAPER_2 = "#a8e0da"    # 背景の帯
NAVY = "#2c3550"       # ステージ背景
FRAME = "#4a4652"
GLOW = "#5fe6da"       # 発光部 (青緑)
CARD = "#c9a57a"       # 段ボールの裏面
ACRYLIC = "#e6eef6"
WHITE_PRINT = "#f3f8f7"

BUST_DROP = {"flat_skirt", "flat_skirt_trim", "flat_sleeve", "flat_cuff", "flat_hand", "flat_thigh", "flat_boot",
             "flat_sole"}


# ---------- 補助 ----------

def flat_shapes(m, M, rnd, *args, **kw):
    """miku_flat の多角形を作らずに記録する。返り値: [(pts, z, t, mat, name)]。"""
    rec = []
    orig = cp.poly
    cp.poly = lambda _m, pts, z, t, mat, name="flat": rec.append((pts, z, t, mat, name))
    try:
        miku_flat(m, M, rnd, *args, **kw)
    finally:
        cp.poly = orig
    return rec


def bust(m, M, rnd, ox, oy, S, z, dz, t, jit=0.01, spread=0.6):
    """胸から上のデフォルメ初音ミク (miku_flat の脚・スカート・腕を除く)。"""
    for pts, zz, tt, mat, name in flat_shapes(m, M, rnd, ox, oy, S, z, dz, t, jit=jit, spread=spread):
        if name not in BUST_DROP:
            poly(m, pts, zz, tt, mat, name=name)


def bend(m, start, fn, maxlen):
    """parts[start:] の辺を maxlen 以下へ分割し、各頂点を fn(Vector)->tuple で曲げる。"""
    for ob in m.parts[start:]:
        m.apply(ob)
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        for _ in range(6):
            long_ = [e for e in bm.edges if e.calc_length() > maxlen]
            if not long_:
                break
            bmesh.ops.subdivide_edges(bm, edges=long_, cuts=1, use_grid_fill=True)
        for v in bm.verts:
            v.co = Vector(fn(v.co.copy()))
        bm.to_mesh(ob.data)
        bm.free()
        ob.data.shade_flat()


def wrap(R, axis_z=0.0):
    """z=0 の正面図を、y 軸まわりの半径 R の円筒へ巻く (x=0 が +Z 正面)。"""
    def fn(co):
        a = co.x / R
        r = R + co.z
        return (r * math.sin(a), co.y, axis_z + r * math.cos(a))
    return fn


def transform_parts(m, start, mt):
    for ob in m.parts[start:]:
        m.apply(ob)
        ob.data.transform(mt)


def flat_parts(m, start):
    for ob in m.parts[start:]:
        ob.data.shade_flat()


def strokes(m, pts, w, z, t, mat, name="line"):
    """閉じた輪郭 pts を幅 w の線 (細い板の集まり) にする。"""
    bm = bmesh.new()
    n = len(pts)
    for i in range(n):
        a, b = Vector(pts[i]), Vector(pts[(i + 1) % n])
        d = b - a
        if d.length < 1e-6:
            continue
        d.normalize()
        nrm = Vector((-d.y, d.x)) * (w / 2)
        a2, b2 = a - d * (w / 2), b + d * (w / 2)
        quad = [a2 - nrm, b2 - nrm, b2 + nrm, a2 + nrm]
        lo = [bm.verts.new((p.x, p.y, z)) for p in quad]
        hi = [bm.verts.new((p.x, p.y, z + t)) for p in quad]
        bm.faces.new(list(reversed(lo)))
        bm.faces.new(hi)
        for k in range(4):
            j = (k + 1) % 4
            bm.faces.new((lo[k], lo[j], hi[j], hi[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = m._obj(bm, mat, name)
    ob.data.shade_flat()
    return ob


def flat_cyl(m, r, h, center, mat, seg, axis="y", name="cyl", r2=None):
    ob = m.cyl(r, h, center, mat, seg=seg, axis=axis, r2=r2, name=name)
    ob.data.shade_flat()
    return ob


def flat_box(m, size, center, mat, rot=None, name="box"):
    ob = m.box(size, center, mat, bevel=0.0, rot=rot, name=name)
    ob.data.shade_flat()
    return ob


def notes(m, M, rnd, items, z, t):
    """items: [(x, y, 大きさ, 二連か)]。二連は桃色、単音は青緑。"""
    for x, y, s, dbl in items:
        note(m, M["pink"] if dbl else M["hair"], x, y, s, z, t, rnd, double=dbl)


# ---------- 等身のある立ち姿 (正面図) ----------
# 単位: 全高 1 (足元 0)。右半分 (x>0) を書き、左は鏡映する。 (形, 層, 素材キー, 名前)

def _tall_shapes():
    side = [
        ([(0.065, 0.985), (0.11, 0.982), (0.16, 0.93), (0.19, 0.8), (0.2, 0.6), (0.195, 0.42), (0.18, 0.26),
          (0.16, 0.17), (0.14, 0.24), (0.145, 0.42), (0.14, 0.6), (0.125, 0.78), (0.09, 0.9)], 0, "hair", "tail"),
        ([(0.03, 0.835), (0.062, 0.822), (0.088, 0.7), (0.07, 0.695), (0.05, 0.79)], 1, "skin", "upper_arm"),
        ([(0.008, 0.57), (0.056, 0.57), (0.052, 0.47), (0.011, 0.47)], 1, "skin", "thigh"),
        ([(0.07, 0.715), (0.098, 0.715), (0.125, 0.565), (0.085, 0.56)], 2, "top", "sleeve"),
        ([(0.009, 0.485), (0.055, 0.485), (0.047, 0.2), (0.046, 0.03), (0.014, 0.03), (0.013, 0.2)], 2, "boots",
         "boot"),
        ([(0.068, 0.705), (0.1, 0.705), (0.1, 0.725), (0.068, 0.725)], 3, "trim", "sleeve_trim"),
        ([(0.082, 0.552), (0.127, 0.558), (0.127, 0.572), (0.083, 0.566)], 3, "trim", "sleeve_trim"),
        ([(0.09, 0.56), (0.115, 0.565), (0.112, 0.525), (0.095, 0.522)], 3, "skin", "hand"),
        ([(0.007, 0.475), (0.057, 0.475), (0.057, 0.495), (0.007, 0.495)], 3, "trim", "boot_trim"),
        ([(0.01, 0.0), (0.056, 0.0), (0.05, 0.034), (0.012, 0.034)], 3, "trim", "sole"),
        ([(0.068, 0.94), (0.048, 0.92), (0.05, 0.83), (0.064, 0.815)], 5, "hair", "side_lock"),
        (ngon(0.075, 0.965, 0.016, 0.02, n=5), 6, "hairtie", "hair_tie"),
        (ngon(0.08, 0.965, 0.006, 0.012, n=4), 7, "pink", "hair_tie_accent"),
        (ngon(0.022, 0.9, 0.011, 0.016, n=6, rot=math.pi / 2), 6, "eyes", "eye"),
        (ngon(0.019, 0.907, 0.004, 0.004, n=4), 7, "white", "eye_light"),
    ]
    mid = [
        (ngon(0, 0.925, 0.075, 0.075, n=8, rot=math.pi / 8), 0, "hair", "hair_back"),
        ([(-0.012, 0.835), (0.012, 0.835), (0.011, 0.865), (-0.011, 0.865)], 1, "skin", "neck"),
        ([(-0.048, 0.665), (0.048, 0.665), (0.055, 0.79), (0.035, 0.832), (-0.035, 0.832), (-0.055, 0.79)], 2, "top",
         "top"),
        ([(-0.05, 0.672), (0.05, 0.672), (0.09, 0.565), (-0.09, 0.565)], 2, "skirt", "skirt"),
        ([(0.0, 0.832), (0.012, 0.826), (0.004, 0.745), (0.0, 0.735), (-0.004, 0.745), (-0.012, 0.826)], 3, "tie",
         "tie"),
        ([(-0.092, 0.555), (0.092, 0.555), (0.09, 0.572), (-0.09, 0.572)], 3, "trim", "skirt_trim"),
        ([(-0.05, 0.935), (-0.045, 0.885), (-0.02, 0.858), (0.02, 0.858), (0.045, 0.885), (0.05, 0.935),
          (0.0, 0.955)], 4, "skin", "face"),
        ([(-0.068, 0.94), (-0.055, 0.895), (-0.04, 0.918), (-0.025, 0.9), (-0.008, 0.922), (0.008, 0.9),
          (0.025, 0.92), (0.04, 0.897), (0.055, 0.916), (0.068, 0.94), (0.06, 0.985), (0.0, 1.0), (-0.06, 0.985)],
         5, "hair", "bangs"),
        ([(-0.006, 0.872), (0.006, 0.872), (0.0, 0.866)], 6, "mouth", "mouth"),
    ]
    out = list(mid)
    for pts, layer, key, name in side:
        out.append((pts, layer, key, name))
        out.append(([(-x, y) for x, y in reversed(pts)], layer, key, name))
    return out


def miku_tall(m, M, rnd, ox, oy, S, z, dz, t, jit=0.003):
    """等身のある初音ミクの立ち姿。足元 (ox, oy)、S=(横, 縦) の倍率 (全高およそ S[1])。"""
    Sx, Sy = S
    for pts, layer, key, name in sorted(_tall_shapes(), key=lambda s: s[1]):
        j = jit * (0.4 if layer >= 5 else 1.0)
        q = [(ox + (x + rnd.uniform(-j, j)) * Sx, oy + (y + rnd.uniform(-j, j)) * Sy) for x, y in pts]
        poly(m, q, z + layer * dz, t, M[key], name="tall_" + name)


# 等身大パネルの切り抜き線 (単位は miku_tall と同じ)。右半分を下から上へ。
STANDEE_OUTLINE = [(0.07, -0.04), (0.07, 0.14), (0.15, 0.135), (0.185, 0.18), (0.205, 0.26), (0.218, 0.42),
                   (0.222, 0.6), (0.212, 0.8), (0.182, 0.94), (0.125, 0.998), (0.07, 1.004), (0.0, 1.015)]


def _mirror_outline(half):
    left = [(-x, y) for x, y in reversed(half) if x > 1e-6]
    return half + left


# ---------- 1. A3ポスター (額装) ----------

@asset("char_hatsune_miku_poster_a3.glb", (0.32, 0.44, 0.02))
def char_hatsune_miku_poster_a3(tint=None):
    m = Model("char_hatsune_miku_poster_a3")
    rnd = random.Random(21)
    M = mats(m)
    frame = m.mat("frame", FRAME, rough=0.85)
    paper = m.mat("paper", PAPER, rough=0.9)
    band = m.mat("paper_pattern", PAPER_2, rough=0.9)
    W, H, D, f = 0.32, 0.44, 0.02, 0.016
    for sx in (-1, 1):
        flat_box(m, (f, H, D), (sx * (W / 2 - f / 2), H / 2, 0), frame, name="frame")
    for y in (f / 2, H - f / 2):
        flat_box(m, (W - 2 * f, f, D), (0, y, 0), frame, name="frame")
    flat_box(m, (W - 2 * f, H - 2 * f, 0.004), (0, H / 2, -D / 2 + 0.002), paper, name="paper")
    z = -D / 2 + 0.004
    iw = W - 2 * f
    # 背景の斜めの帯と丸
    for y0, y1 in ((0.07, 0.11), (0.3, 0.33)):
        poly(m, [(-iw / 2, y0), (iw / 2, y0 + 0.08), (iw / 2, y1 + 0.08), (-iw / 2, y1)], z, 0.0005, band,
             name="band")
    poly(m, ngon(0, 0.25, 0.12, 0.12, n=12), z + 0.0005, 0.0005, band, name="circle")
    miku_flat(m, M, rnd, 0, f + 0.035, (0.27, 0.32), z + 0.001, 0.0003, 0.0003, jit=0.01, spread=0.75)
    notes(m, M, rnd, [(-0.1, 0.34, 0.035, False), (0.07, 0.36, 0.03, True), (0.1, 0.15, 0.028, False),
                      (-0.12, 0.13, 0.025, True)], z + 0.0005, 0.0005)
    return m


# ---------- 2. 等身大タペストリー ----------

@asset("char_hatsune_miku_tapestry_life.glb", (0.60, 1.58, 0.015))
def char_hatsune_miku_tapestry_life(tint=None):
    m = Model("char_hatsune_miku_tapestry_life")
    rnd = random.Random(23)
    M = mats(m)
    fab = m.mat("fabric", PAPER, rough=0.95)
    deco = m.mat("fabric_pattern", PAPER_2, rough=0.95)
    rod = m.mat("rod", FRAME, rough=0.85)
    cord = m.mat("string", FRAME, rough=0.9)
    W, H, D = 0.60, 1.58, 0.015
    r = D / 2
    loop = 0.06
    top = H - loop - r
    bot = r
    cw = W - 0.03
    flat_box(m, (cw, top - bot, 0.002), (0, (top + bot) / 2, -0.004), fab, name="cloth")
    zf = -0.003
    for y0, y1 in ((0.25, 0.36), (0.9, 0.97)):
        poly(m, [(-cw / 2, y0), (cw / 2, y0 + 0.22), (cw / 2, y1 + 0.22), (-cw / 2, y1)], zf, 0.0008, deco,
             name="band")
    # 足元の丸いステージ
    poly(m, ngon(0, 0.09, 0.2, 0.045, n=10), zf + 0.0008, 0.0006, M["trim"], name="stage")
    miku_tall(m, M, rnd, 0, 0.08, (1.3, 1.36), zf + 0.0014, 0.0003, 0.0003)
    notes(m, M, rnd, [(-0.23, 1.2, 0.07, False), (0.17, 1.28, 0.06, True), (0.2, 0.62, 0.05, False),
                      (-0.24, 0.5, 0.05, True), (-0.2, 0.92, 0.04, False)], zf + 0.0008, 0.0006)
    for y in (top, bot):
        flat_cyl(m, r, W, (0, y, 0), rod, seg=6, axis="x", name="rod")
    peak = (0, H - 0.0015, 0)
    for sx in (-1, 1):
        m.rod((sx * (W / 2 - 0.015), top + r * 0.6, 0), peak, 0.0015, cord, seg=4, name="string")
    return m


# ---------- 3. 等身大パネル ----------

@asset("char_hatsune_miku_standee.glb", (0.60, 1.58, 0.30))
def char_hatsune_miku_standee(tint=None):
    """段ボールの切り抜きパネル。前面に白い縁と絵柄、背面は無地の段ボール。裏の支え板と小さな台。"""
    m = Model("char_hatsune_miku_standee")
    rnd = random.Random(25)
    M = mats(m)
    card = m.mat("cardboard", CARD, rough=0.95)
    face = m.mat("print_bg", WHITE_PRINT, rough=0.9)
    W, H = 0.60, 1.58
    ys = [y for _, y in STANDEE_OUTLINE]
    Sx = (W / 2) / max(x for x, _ in STANDEE_OUTLINE)
    Sy = H / (max(ys) - min(ys))
    oy = -min(ys) * Sy  # 単位の y=0 (足元) の高さ
    outline = [(x * Sx, oy + y * Sy) for x, y in _mirror_outline(STANDEE_OUTLINE)]
    t = 0.005
    poly(m, outline, 0.0, t, card, name="panel")
    inner = [(x * 0.995, oy + (y - oy) * 0.997 + 0.002) for x, y in outline]
    poly(m, inner, t, 0.0005, face, name="panel_front")
    miku_tall(m, M, rnd, 0, oy, (Sx * 0.98, Sy * 0.985), t + 0.0005, 0.0003, 0.0003)
    # 台 (前後に脚を挟む段ボールの箱)
    bh = 0.05
    flat_box(m, (0.26, bh, 0.1), (0, bh / 2, 0.0), card, name="base")
    # 裏の支え板: パネル背面の上から床の奥へ
    hy, back = 0.85, 0.245
    L = math.hypot(hy, back)
    ang = math.degrees(math.atan2(back, hy))
    flat_box(m, (0.14, L, 0.004), (0, hy / 2, -back / 2 - 0.002), card, rot=(ang, 0, 0), name="easel")
    flat_box(m, (0.16, 0.04, 0.002), (0, hy - 0.01, -0.001), card, name="easel_hinge")
    return m


# ---------- 4. 壁掛け時計 ----------

@asset("char_hatsune_miku_wall_clock.glb", (0.30, 0.34, 0.04))
def char_hatsune_miku_wall_clock(tint=None):
    """丸い時計の上の両側にツインテールの形の飾り。文字盤にデフォルメの絵柄。"""
    m = Model("char_hatsune_miku_wall_clock")
    rnd = random.Random(27)
    M = mats(m)
    dial = m.mat("dial", PAPER, rough=0.9)
    ink = m.mat("ink", cp.BLACK, rough=0.9)
    R, cy = 0.125, 0.155
    zb = -0.02
    # ツインテール (本体の後ろの平たい板)
    tail = [(0.05, 0.25), (0.075, 0.315), (0.12, 0.34), (0.15, 0.3), (0.152, 0.18), (0.145, 0.07), (0.13, 0.0),
            (0.115, 0.06), (0.108, 0.15)]
    for sx in (-1, 1):
        pts = [(sx * x + rnd.uniform(-0.003, 0.003), y + rnd.uniform(-0.003, 0.003)) for x, y in tail]
        if sx < 0:
            pts = pts[::-1]
        poly(m, pts, zb, 0.014, M["hair"], name="tail")
        poly(m, ngon(sx * 0.098, 0.292, 0.026, 0.03, n=6, rot=0.3), zb + 0.014, 0.008, M["hairtie"], name="hair_tie")
        poly(m, ngon(sx * 0.1, 0.292, 0.009, 0.016, n=4), zb + 0.022, 0.002, M["pink"], name="hair_tie_accent")
    flat_cyl(m, R, 0.03, (0, cy, zb + 0.015), M["hair"], seg=16, axis="z", name="body")
    zd = zb + 0.03
    flat_cyl(m, R - 0.016, 0.002, (0, cy, zd + 0.001), dial, seg=16, axis="z", name="dial")
    zd += 0.002
    for k in range(12):
        a = math.tau * k / 12
        r = R - 0.03
        s = 0.009 if k % 3 == 0 else 0.005
        poly(m, ngon(r * math.sin(a), cy + r * math.cos(a), s, s, n=4, rot=a), zd, 0.001,
             M["trim"] if k % 3 == 0 else M["hair"], name="tick")
    bust(m, M, rnd, 0, cy - 0.085, 0.085, zd, 0.0002, 0.0002, spread=0.5)
    notes(m, M, rnd, [(-0.06, cy + 0.03, 0.025, False), (0.035, cy + 0.035, 0.022, True)], zd, 0.0005)
    zh = zd + 0.0025
    poly(m, [(-0.004, cy - 0.01), (0.004, cy - 0.01), (0.003, cy + 0.06), (-0.003, cy + 0.06)], zh, 0.002, ink,
         name="minute_hand")
    hand = [(-0.005, -0.008), (0.005, -0.008), (0.004, 0.045), (-0.004, 0.045)]
    a = math.radians(-60)
    poly(m, [(x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)) for x, y in hand],
         zh + 0.002, 0.002, ink, name="hour_hand")
    flat_cyl(m, 0.007, 0.003, (0, cy, zh + 0.0055), M["pink"], seg=6, axis="z", name="hub")
    return m


# ---------- 5. マグカップ ----------

@asset("char_hatsune_miku_mug.glb", (0.12, 0.10, 0.09))
def char_hatsune_miku_mug(tint=None):
    m = Model("char_hatsune_miku_mug")
    rnd = random.Random(29)
    M = mats(m)
    body = m.mat("mug", WHITE_PRINT, rough=0.85)
    R, H = 0.043, 0.10
    seg = 16
    ob = m.lathe([(0.0, 0.0), (R - 0.003, 0.0), (R, 0.005), (R, H), (R - 0.0035, H), (R - 0.0035, 0.014),
                  (0.0, 0.014)], (0, 0, 0), body, seg=seg, cap_bottom=False, cap_top=False, name="mug")
    ob.data.shade_flat()
    ob = m.lathe([(R - 0.0037, H - 0.0005), (R - 0.0037, 0.0145), (0.0, 0.0145)], (0, 0, 0), M["trim"], seg=seg,
                 cap_bottom=False, cap_top=False, name="mug_inside")
    ob.data.shade_flat()
    for y0, y1 in ((0.006, 0.014), (H - 0.009, H - 0.003)):
        ob = m.lathe([(R + 0.0006, y0), (R + 0.0006, y1)], (0, 0, 0), M["trim"], seg=seg, cap_bottom=False,
                     cap_top=False, name="band")
        ob.data.shade_flat()
    # 取っ手 (+X 側)
    pts = [Vector((R - 0.002 + 0.03 * math.sin(math.pi * i / 6), 0.05 + 0.03 * math.cos(math.pi * i / 6), 0))
           for i in range(7)]
    for p0, p1 in zip(pts, pts[1:]):
        m.rod(p0, p1, 0.0055, M["hair"], seg=6, name="handle")
        m.parts[-1].data.shade_flat()
    # 正面 (+Z) の絵柄を円筒へ巻く
    start = len(m.parts)
    bust(m, M, rnd, 0, 0.022, (0.06, 0.066), 0.0, 0.0002, 0.0002, spread=0.6)
    notes(m, M, rnd, [(-0.052, 0.06, 0.017, False), (0.034, 0.068, 0.014, True), (0.04, 0.03, 0.013, False)],
          0.0, 0.0003)
    bend(m, start, wrap(R + 0.0008), 0.006)
    return m


# ---------- 6. アクリルジオラマ ----------

@asset("char_hatsune_miku_diorama.glb", (0.16, 0.14, 0.08))
def char_hatsune_miku_diorama(tint=None):
    """透明な台座に、ステージの背景板と前のキャラクター板を差し込む。"""
    m = Model("char_hatsune_miku_diorama")
    rnd = random.Random(31)
    M = mats(m)
    acr = m.mat("acrylic", ACRYLIC, rough=0.08, alpha=0.4)
    stage_bg = m.mat("print_bg", NAVY, rough=0.85)
    beam = m.mat("print_light", "#6fb8c9", rough=0.85)
    floor = m.mat("print_floor", "#3f4a6e", rough=0.85)
    W, H, D = 0.16, 0.14, 0.08
    bh = 0.012
    flat_box(m, (W, bh, D), (0, bh / 2, 0), acr, name="base")
    # 背景板: 上が丸いアーチ
    zb, th = -0.028, 0.003
    hw = 0.074
    arch = [(-hw, bh - 0.004), (hw, bh - 0.004), (hw, 0.085)]
    arch += [(hw * math.cos(math.pi * i / 8), 0.085 + 0.055 * math.sin(math.pi * i / 8)) for i in range(1, 8)]
    arch += [(-hw, 0.085)]
    poly(m, arch, zb, th, stage_bg, name="back_panel")
    zf = zb + th
    poly(m, [(-hw, bh), (hw, bh), (hw * 0.8, bh + 0.035), (-hw * 0.8, bh + 0.035)], zf, 0.0004, floor,
         name="stage_floor")
    for sx in (-1, 1):
        poly(m, [(sx * 0.052, 0.118), (sx * 0.04, 0.12), (sx * 0.005, bh + 0.03), (sx * 0.04, bh + 0.03)],
             zf + 0.0004, 0.0004, beam, name="spot_beam")
    notes(m, M, rnd, [(-0.06, 0.1, 0.014, False), (0.045, 0.108, 0.012, True), (0.05, 0.07, 0.011, False),
                      (-0.058, 0.06, 0.01, True)], zf + 0.0008, 0.0004)
    # キャラクター板 (絵柄の外形に沿う透明板)
    th2 = 0.003
    zc = 0.008
    pts = miku_flat(m, M, rnd, 0, bh + 0.002, (0.1, 0.105), zc + th2 / 2, 0.0003, 0.0004, jit=0.01, spread=0.45)
    hull = [pts[i] for i in convex_hull_2d(pts)]
    cx = sum(p[0] for p in hull) / len(hull)
    cyy = sum(p[1] for p in hull) / len(hull)
    board = []
    for x, y in hull:
        q = Vector((x, y)) + (Vector((x - cx, y - cyy))).normalized() * 0.004
        board.append((q.x, max(q.y, bh - 0.004)))
    poly(m, board, zc - th2 / 2, th2, acr, name="chara_panel")
    return m


# ---------- 7. デスクマット ----------

@asset("char_hatsune_miku_desk_mat.glb", (0.60, 0.003, 0.30))
def char_hatsune_miku_desk_mat(tint=None):
    m = Model("char_hatsune_miku_desk_mat")
    rnd = random.Random(33)
    M = mats(m)
    rub = m.mat("rubber", FRAME, rough=0.95)
    prt = m.mat("print_bg", PAPER, rough=0.9)
    deco = m.mat("print_pattern", PAPER_2, rough=0.9)
    W, D = 0.60, 0.30
    m.prism(rrect(W, D, 0.02, seg=3), 0.0018, rub, plane="xz", offset=0.0, name="rubber")
    m.prism(rrect(W - 0.004, D - 0.004, 0.019, seg=3), 0.0006, prt, plane="xz", offset=0.0018, name="print_top")
    flat_parts(m, 0)
    # 絵柄は正面図で作り、上面へ寝かせる (絵の上が奥 -Z)
    start = len(m.parts)
    for y0, y1 in ((-0.13, -0.09), (0.05, 0.075)):
        poly(m, [(-0.29, y0), (0.29, y0 + 0.06), (0.29, y1 + 0.06), (-0.29, y1)], 0.0, 0.0001, deco, name="band")
    miku_flat(m, M, rnd, -0.15, -0.14, (0.28, 0.285), 0.0001, 0.00005, 0.00005, jit=0.01, spread=0.8)
    notes(m, M, rnd, [(0.07, 0.05, 0.045, False), (0.17, 0.07, 0.04, True), (0.21, -0.1, 0.036, False),
                      (0.06, -0.11, 0.032, True)], 0.0001, 0.0001)
    transform_parts(m, start, Matrix.Translation((0, 0.0024, 0)) @ rot_matrix((-90, 0, 0)))
    return m


# ---------- 8. ペンライト ----------

@asset("char_hatsune_miku_penlight.glb", (0.06, 0.25, 0.06))
def char_hatsune_miku_penlight(tint=None):
    m = Model("char_hatsune_miku_penlight")
    rnd = random.Random(35)
    M = mats(m)
    stand = m.mat("stand", WHITE_PRINT, rough=0.85)
    grip = m.mat("grip", cp.GRAY, rough=0.9)
    light = m.mat("light", GLOW, rough=0.5, emit=GLOW, strength=2.0)
    shell = m.mat("acrylic", ACRYLIC, rough=0.08, alpha=0.35)
    flat_cyl(m, 0.03, 0.008, (0, 0.004, 0), stand, seg=10, name="stand_base")
    flat_cyl(m, 0.017, 0.03, (0, 0.008 + 0.015, 0), stand, seg=10, name="stand_cup")
    r = 0.0125
    flat_cyl(m, r, 0.088, (0, 0.012 + 0.044, 0), grip, seg=10, name="grip")
    for y, mat in ((0.084, M["trim"]), (0.09, M["pink"]), (0.096, M["hairtie"])):
        flat_cyl(m, r + 0.0008, 0.005, (0, y, 0), mat, seg=10, name="ring")
    flat_box(m, (0.006, 0.006, 0.003), (0, 0.077, r + 0.001), M["trim"], name="button")
    flat_cyl(m, 0.0105, 0.142, (0, 0.0985 + 0.071, 0), light, seg=10, name="tube")
    flat_cyl(m, 0.0115, 0.142, (0, 0.0985 + 0.071, 0), shell, seg=10, name="tube_shell")
    flat_cyl(m, 0.0115, 0.009, (0, 0.2405 + 0.0045, 0), light, seg=10, r2=0.004, name="tip")
    # 持ち手の絵柄 (円筒へ巻く)
    start = len(m.parts)
    bust(m, M, rnd, 0, 0.042, (0.024, 0.03), 0.0, 0.00015, 0.00015, spread=0.5)
    bend(m, start, wrap(r + 0.0004), 0.002)
    return m


# ---------- 9. 缶バッジ ----------

@asset("char_hatsune_miku_can_badge.glb", (0.057, 0.057, 0.012))
def char_hatsune_miku_can_badge(tint=None):
    m = Model("char_hatsune_miku_can_badge")
    rnd = random.Random(37)
    M = mats(m)
    prt = m.mat("print_bg", PAPER, rough=0.6)
    acr = m.mat("acrylic", ACRYLIC, rough=0.08, alpha=0.4)
    r = 0.0285
    cy = r
    z0 = -0.0005
    back = [(0.0, 0.0), (r * 0.98, 0.0), (r, 0.0025), (r * 0.965, 0.004)]
    dome = [(r * 0.965, 0.004), (r * 0.85, 0.0056), (r * 0.6, 0.0066), (r * 0.3, 0.0071), (0.0, 0.0072)]
    for prof, mat, nm in ((back, M["trim"], "badge_back"), (dome, prt, "badge_face")):
        ob = m.lathe(prof, (0, 0, 0), mat, seg=20, cap_bottom=(nm == "badge_back"), cap_top=False, name=nm)
        m.apply(ob)
        ob.data.transform(Matrix.Translation((0, cy, z0)) @ rot_matrix((90, 0, 0)))
        ob.data.shade_flat()
    prof = sorted(dome)

    def height(rho):
        for (r0, h0), (r1, h1) in zip(prof, prof[1:]):
            if rho <= r1:
                return h0 + (h1 - h0) * (rho - r0) / max(r1 - r0, 1e-9)
        return prof[-1][1]

    start = len(m.parts)
    bust(m, M, rnd, 0, cy - 0.019, 0.04, 0.0, 0.00012, 0.00012, jit=0.008, spread=0.55)

    def fn(co):
        rho = math.hypot(co.x, co.y - cy)
        return (co.x, co.y, z0 + height(rho) + 0.0001 + co.z)

    bend(m, start, fn, 0.003)
    t = 0.0015
    flat_box(m, (0.026, 0.004, 0.011), (0, 0.002, 0.0), acr, name="easel_foot")
    flat_box(m, (0.018, 0.035, t), (0, 0.0175, -0.0028), acr, rot=(-5, 0, 0), name="easel_back")
    flat_box(m, (0.026, 0.006, t), (0, 0.003, 0.0058), acr, name="easel_lip")
    return m


# ---------- 10. うちわ ----------

@asset("char_hatsune_miku_uchiwa.glb", (0.25, 0.38, 0.10))
def char_hatsune_miku_uchiwa(tint=None):
    m = Model("char_hatsune_miku_uchiwa")
    rnd = random.Random(41)
    M = mats(m)
    face = m.mat("print_bg", PAPER, rough=0.85)
    frame = m.mat("frame", WHITE_PRINT, rough=0.85)
    stand = m.mat("stand", FRAME, rough=0.85)
    R, cy = 0.12, 0.26
    seg = 20
    flat_cyl(m, R, 0.003, (0, cy, 0), face, seg=seg, axis="z", name="face")
    ring = [(R + 0.0035 * math.cos(math.tau * i / 6), 0.0035 * math.sin(math.tau * i / 6)) for i in range(6)]
    ob = m.lathe(ring, (0, 0, 0), M["trim"], seg=seg, closed=True, cap_bottom=False, cap_top=False, name="rim")
    ob.data.transform(Matrix.Translation((0, cy, 0)) @ rot_matrix((90, 0, 0)))
    ob.data.shade_flat()
    for k in range(7):
        a = math.radians(-60 + 120 * k / 6) + math.pi / 2
        m.rod((0, cy - R + 0.02, -0.0025), (R * 0.95 * math.cos(a), cy + R * 0.95 * math.sin(a), -0.0025), 0.0012,
              frame, seg=4, name="rib")
    flat_box(m, (0.022, 0.15, 0.012), (0, 0.018 + 0.075, -0.003), frame, name="handle")
    z = 0.0015
    poly(m, ngon(0, cy, 0.1, 0.1, n=12, rot=0.2), z, 0.0004, M["hair"], name="print_circle")
    poly(m, ngon(0, cy, 0.092, 0.092, n=12, rot=0.2), z + 0.0004, 0.0004, face, name="print_circle_inner")
    miku_flat(m, M, rnd, 0, cy - 0.085, (0.15, 0.165), z + 0.0008, 0.0003, 0.0003, jit=0.01, spread=0.6)
    notes(m, M, rnd, [(-0.085, cy + 0.04, 0.022, False), (0.06, cy + 0.06, 0.018, True),
                      (0.07, cy - 0.06, 0.016, False)], z + 0.0008, 0.0004)
    flat_box(m, (0.12, 0.018, 0.10), (0, 0.009, 0), stand, name="stand_base")
    for sx in (-1, 1):
        flat_box(m, (0.012, 0.045, 0.03), (sx * 0.0175, 0.018 + 0.0225, -0.003), stand, name="stand_clip")
    return m


# ---------- 11. LEDアクリルライト ----------

@asset("char_hatsune_miku_led_light.glb", (0.15, 0.20, 0.08))
def char_hatsune_miku_led_light(tint=None):
    """暗い台座に差したアクリル板。デフォルメの線画が青緑に光る。"""
    m = Model("char_hatsune_miku_led_light")
    rnd = random.Random(43)
    M = mats(m)
    base = m.mat("base", "#2f2d36", rough=0.85)
    acr = m.mat("acrylic", ACRYLIC, rough=0.08, alpha=0.3)
    light = m.mat("light", GLOW, rough=0.5, emit=GLOW, strength=2.2)
    W, H, D = 0.15, 0.20, 0.08
    bh = 0.035
    flat_box(m, (W, bh, D), (0, bh / 2, 0), base, name="base")
    flat_box(m, (0.13, 0.002, 0.008), (0, bh + 0.001, 0), light, name="slot_glow")
    pw, ph, th = 0.13, H - bh + 0.01, 0.005
    plate = [(x, bh - 0.01 + ph / 2 + z) for x, z in rrect(pw, ph, 0.012, seg=3)]
    poly(m, plate, -th / 2, th, acr, name="plate")
    # 線画: miku_flat の輪郭を細い線にする
    S = (0.118, 0.13)
    shapes = flat_shapes(m, M, rnd, 0, bh + 0.012, S, 0.0, 0.0, 0.0, jit=0.008, spread=0.6)
    skip = {"flat_cuff", "flat_skirt_trim", "flat_hair_tie_accent", "flat_eye_light", "flat_shoulder", "flat_neck",
            "flat_sole"}
    for pts, _, _, _, name in shapes:
        if name in skip:
            continue
        if name in ("flat_eye", "flat_mouth"):
            poly(m, pts, th / 2, 0.0004, light, name="line_dot")
        else:
            strokes(m, pts, 0.0011, th / 2, 0.0004, light, name="line")
    notes(m, {"pink": light, "hair": light}, rnd, [(-0.05, 0.16, 0.014, False), (0.035, 0.168, 0.012, True)],
          th / 2, 0.0004)
    return m
