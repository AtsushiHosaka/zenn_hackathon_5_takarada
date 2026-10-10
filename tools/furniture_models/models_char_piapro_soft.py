"""初音ミクの布もの・ぬいぐるみの二次創作モデル (非商用・個人の範囲。ピアプロ・キャラクター・ライセンスに従う)。
models_char_piapro と同じ、わざと粗いローポリ (少ない分割・フラットシェーディング・ベベルなし・決まった種の揺れ)。
平らな絵柄は正面図 (x, y) の多角形で作り、布の上面に沿わせて置く。床置きの物は上面 +Y、絵柄の上は奥 (-Z)。"""
import math
import random

import bmesh
import bpy
from lib import Model, asset, rrect
from mathutils import Matrix, Vector
from mathutils.geometry import convex_hull_2d
from models_char_piapro import (TEAL, TEAL_DARK, _plush, cone, head3d, lump, mats, miku_flat, ngon, note, poly,
                                rough, tube)

FABRIC = "#e4f4f1"      # 白に近い青緑の布地
NOTE_LIGHT = "#d8f3ef"


def lying(u, v, w):
    """絵柄の座標 (u, v) と高さ w を床置きの座標へ。絵柄の上 (+v) は奥 (-Z)。"""
    return (u, w, -v)


def standing(depth):
    """立てて置く物: 絵柄はそのまま正面、高さ w は奥行き方向 (背面が -depth/2)。"""
    return lambda u, v, w: (u, v, w - depth / 2)


def superellipse(a, b, p, n, rot=0.0):
    """角の丸い長方形〜楕円の輪郭 (反時計回り)。p=2 で楕円、大きいほど角張る。"""
    pts = []
    for i in range(n):
        t = math.tau * i / n + rot
        c, s = math.cos(t), math.sin(t)
        pts.append((a * math.copysign(abs(c) ** (2 / p), c), b * math.copysign(abs(s) ** (2 / p), s)))
    return pts


def _ray(outline, cx, cy, dx, dy):
    """中心から方向 (dx, dy) へ伸ばした線が輪郭と交わるまでの長さ。"""
    best = 0.0
    n = len(outline)
    for i in range(n):
        x1, y1 = outline[i]
        x2, y2 = outline[(i + 1) % n]
        ex, ey = x2 - x1, y2 - y1
        den = dx * ey - dy * ex
        if abs(den) < 1e-12:
            continue
        wx, wy = x1 - cx, y1 - cy
        t = (wx * ey - wy * ex) / den
        s = (wx * dy - wy * dx) / den
        if t > 0 and -1e-9 <= s <= 1 + 1e-9:
            best = max(best, t)
    return best or 1e-9


def puff(m, outline, H, top_mat, bot_mat, rnd, to3, hs=0.3, rings=(1.0, 0.9, 0.72, 0.48, 0.22), k=4, jit=0.002,
         name="cushion"):
    """輪郭 (u, v) から上下に膨らんだ布の塊を作る。高さ w は 0〜H。上面 top_mat、下面と側面 bot_mat。
    hs: 側面の帯の厚みの割合。k: 大きいほど中央が平ら。返り値: 上面の高さ top(u, v) (網の面と同じ折れ線)。"""
    n = len(outline)
    cx = sum(p[0] for p in outline) / n
    cy = sum(p[1] for p in outline) / n
    h0 = hs * H / 2

    def prof(s):
        return math.sqrt(max(0.0, 1 - min(1.0, s) ** k))

    knots = sorted([(s, prof(s)) for s in rings] + [(0.0, 1.0)])
    bm = bmesh.new()

    def ring(s, sgn):
        w = H / 2 + sgn * (h0 + (H / 2 - h0) * prof(s))
        return [bm.verts.new(to3(cx + (x - cx) * s, cy + (y - cy) * s, w)) for x, y in outline]

    top_faces = set()
    edges = []
    for sgn in (1, -1):
        rs = [ring(s, sgn) for s in rings]
        tip = bm.verts.new(to3(cx, cy, H / 2 + sgn * H / 2))
        made = []
        for a, b in zip(rs, rs[1:]):
            for i in range(n):
                j = (i + 1) % n
                made.append(bm.faces.new((a[i], a[j], b[j], b[i])))
        for i in range(n):
            made.append(bm.faces.new((rs[-1][i], rs[-1][(i + 1) % n], tip)))
        if sgn > 0:
            top_faces.update(made)
        edges.append(rs[0])
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((edges[0][i], edges[0][j], edges[1][j], edges[1][i]))
    ctr = Vector(to3(cx, cy, H / 2))
    bm.normal_update()
    for f in bm.faces:
        if f.normal.dot(f.calc_center_median() - ctr) < 0:
            f.normal_flip()
        f.material_index = 0 if (f in top_faces or bot_mat is top_mat) else 1
    ob = m._obj(bm, top_mat, name)
    if bot_mat is not top_mat:
        ob.data.materials.append(bot_mat)
    rough(m, ob, rnd, jit)

    def top(u, v):
        du, dv = u - cx, v - cy
        L = math.hypot(du, dv)
        s = 0.0 if L < 1e-9 else L / _ray(outline, cx, cy, du / L, dv / L)
        if s >= 1.0:
            p = 0.0
        else:
            for (s0, p0), (s1, p1) in zip(knots, knots[1:]):
                if s <= s1:
                    p = p0 + (p1 - p0) * (s - s0) / (s1 - s0)
                    break
        return H / 2 + h0 + (H / 2 - h0) * p

    return top


def piping(m, outline, H, mat, rnd, to3, r, name="piping"):
    """縫い目の玉縁 (輪郭に沿う細い管)。"""
    path = [to3(x, y, H / 2) + (r,) for x, y in outline]
    tube(m, path + [path[0]], mat, rnd, seg=5, jit=0.05, name=name)


def _refine(m, ob, step):
    """長い辺を分けて、曲がった布の上面に絵柄が沈まないようにする。"""
    m.apply(ob)
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    for _ in range(4):
        long_ = [e for e in bm.edges if e.calc_length() > step]
        if not long_:
            break
        bmesh.ops.subdivide_edges(bm, edges=long_, cuts=1, use_grid_fill=True)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.shade_flat()


def lay(m, start, top, to3, rot=0.0, dx=0.0, dy=0.0, step=None):
    """start 以降の部品 (正面図の平らな絵柄。z は層の高さ) を回転・移動し、布の上面 top に沿わせる。
    step: 曲面に置く場合の辺の最大長 (m)。"""
    c, s = math.cos(rot), math.sin(rot)
    for ob in m.parts[start:]:
        if step:
            _refine(m, ob, step)
        def fn(co):
            x = co.x * c - co.y * s + dx
            y = co.x * s + co.y * c + dy
            return to3(x, y, top(x, y) + co.z)
        m.deform(ob, fn)


BODY_PARTS = {"flat_top", "flat_neck", "flat_tie", "flat_skirt", "flat_skirt_trim", "flat_shoulder", "flat_sleeve",
              "flat_cuff", "flat_hand", "flat_thigh", "flat_boot", "flat_sole"}


def head_flat(m, M, rnd, cx, cy, S, z, dz, t, spread=1.0):
    """頭とツインテールだけの平らな絵柄。(cx, cy) がおよその中心、全高およそ 0.91*S。"""
    start = len(m.parts)
    miku_flat(m, M, rnd, cx, cy - 0.5 * S, S, z, dz, t, spread=spread)
    drop = [ob for ob in m.parts[start:] if ob.name.split(".")[0] in BODY_PARTS]
    for ob in drop:
        m.parts.remove(ob)
        me = ob.data
        bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.meshes.remove(me)


def notes(m, M, rnd, spots, z, t):
    """spots: [(x, y, 大きさ, 2連か)]。2連は桃色、単音は濃い青緑。"""
    for x, y, s, dbl in spots:
        note(m, M["pink"] if dbl else M["tie"], x, y, s, z, t, rnd, double=dbl)


# ---------- クッション ----------

@asset("char_hatsune_miku_cushion_round.glb", (0.45, 0.14, 0.45))
def char_hatsune_miku_cushion_round(tint=None):
    """床に置いた丸クッション。上面に頭とツインテールの絵柄と音符、下面は青緑。"""
    m = Model("char_hatsune_miku_cushion_round")
    rnd = random.Random(21)
    M = mats(m)
    fab = m.mat("fabric", FABRIC, rough=0.95)
    back = m.mat("fabric_back", TEAL, rough=0.95)
    pipe = m.mat("piping", TEAL_DARK, rough=0.9)
    H = 0.14
    outline = ngon(0, 0, 0.217, 0.217, n=16)
    top = puff(m, outline, H, fab, back, rnd, lying, hs=0.3, jit=0.002, name="cushion")
    piping(m, outline, H, pipe, rnd, lying, 0.007)
    start = len(m.parts)
    head_flat(m, M, rnd, 0, 0.01, 0.3, -0.003, 0.0006, 0.005)
    notes(m, M, rnd, [(-0.075, -0.125, 0.045, False), (0.01, -0.13, 0.04, True), (0.12, 0.13, 0.035, False),
                      (-0.16, 0.1, 0.03, True)], -0.003, 0.005)
    lay(m, start, top, lying, step=0.04)
    return m


@asset("char_hatsune_miku_cushion_square.glb", (0.45, 0.15, 0.45))
def char_hatsune_miku_cushion_square(tint=None):
    """床に置いた四角いクッション。青緑の玉縁、上面に全身のデフォルメ絵柄。"""
    m = Model("char_hatsune_miku_cushion_square")
    rnd = random.Random(22)
    M = mats(m)
    fab = m.mat("fabric", FABRIC, rough=0.95)
    back = m.mat("fabric_back", TEAL, rough=0.95)
    pipe = m.mat("piping", TEAL_DARK, rough=0.9)
    H = 0.15
    outline = superellipse(0.217, 0.217, 5, 24)
    top = puff(m, outline, H, fab, back, rnd, lying, hs=0.3, jit=0.002, name="cushion")
    piping(m, outline, H, pipe, rnd, lying, 0.008)
    start = len(m.parts)
    miku_flat(m, M, rnd, 0, -0.145, 0.3, -0.003, 0.0006, 0.005, jit=0.01)
    notes(m, M, rnd, [(-0.17, 0.1, 0.04, False), (0.12, 0.11, 0.035, True), (0.14, -0.15, 0.03, False),
                      (-0.18, -0.14, 0.03, True)], -0.003, 0.005)
    lay(m, start, top, lying, step=0.04)
    return m


@asset("char_hatsune_miku_cushion_body.glb", (0.30, 0.60, 0.12))
def char_hatsune_miku_cushion_body(tint=None):
    """全身の形に切り抜いて立てるダイカットクッション。正面に全身の絵柄、背面と側面は無地の青緑。"""
    m = Model("char_hatsune_miku_cushion_body")
    rnd = random.Random(23)
    M = mats(m)
    fab = m.mat("fabric", FABRIC, rough=0.95)
    back = m.mat("fabric_back", TEAL, rough=0.95)
    D = 0.12
    to3 = standing(D)
    start = len(m.parts)
    pts = miku_flat(m, M, rnd, 0, 0.022, (0.37, 0.58), -0.003, 0.0006, 0.005, jit=0.01, spread=0.3)
    end = len(m.parts)
    # 絵柄の外形 (凸包) を少し広げた輪郭
    hull = [pts[i] for i in convex_hull_2d(pts)]
    cx = sum(p[0] for p in hull) / len(hull)
    cy = sum(p[1] for p in hull) / len(hull)
    outline = []
    for x, y in hull:
        d = Vector((x - cx, y - cy))
        q = Vector((x, y)) + d.normalized() * 0.022
        outline.append((q.x, q.y))
    area = sum(outline[i][0] * outline[(i + 1) % len(outline)][1] - outline[(i + 1) % len(outline)][0] *
               outline[i][1] for i in range(len(outline)))
    if area < 0:
        outline.reverse()
    top = puff(m, outline, D, fab, back, rnd, to3, hs=0.35, k=4, jit=0.002, name="cushion")
    # 絵柄だけを前面へ (クッション本体は末尾に追加済み)
    body = m.parts[end:]
    m.parts[end:] = []
    lay(m, start, top, to3, step=0.03)
    m.parts.extend(body)
    return m


@asset("char_hatsune_miku_seat_cushion.glb", (0.55, 0.07, 0.59))
def char_hatsune_miku_seat_cushion(tint=None):
    """青緑の座布団。中央の白い丸に頭の絵柄、四隅に房。"""
    m = Model("char_hatsune_miku_seat_cushion")
    rnd = random.Random(31)
    M = mats(m)
    fab = m.mat("fabric", "#86d3cb", rough=0.95)
    patch = m.mat("fabric_patch", FABRIC, rough=0.95)
    tassel = m.mat("tassel", TEAL_DARK, rough=0.9)
    W, H, D = 0.55, 0.064, 0.59  # 絵柄の厚みの分だけ本体を低くする
    a, b = W / 2 - 0.002, D / 2 - 0.002
    outline = superellipse(a, b, 6, 24)
    top = puff(m, outline, H, fab, fab, rnd, lying, hs=0.35, jit=0.002, name="zabuton")
    start = len(m.parts)
    poly(m, ngon(0, 0, 0.2, 0.2, n=14), -0.0035, 0.005, patch, name="patch")
    head_flat(m, M, rnd, 0, 0.01, 0.3, -0.0025, 0.0006, 0.005)
    notes(m, M, rnd, [(-0.07, -0.12, 0.04, False), (0.01, -0.125, 0.036, True)], -0.0025, 0.005)
    lay(m, start, top, lying, step=0.05)
    k = 0.5 ** (1 / 6)
    for sx in (-1, 1):
        for sy in (-1, 1):
            lump(m, lying(sx * a * k, sy * b * k, H / 2), (0.016, 0.012, 0.016), tassel, rnd, seg=6, rings=4,
                 name="corner_tassel")
    return m


# ---------- 抱き枕 ----------

@asset("char_hatsune_miku_dakimakura.glb", (1.60, 0.18, 0.50))
def char_hatsune_miku_dakimakura(tint=None):
    """横長に寝かせた抱き枕。上面にいつもの衣装の全身デフォルメ絵柄 (頭が -X)。"""
    m = Model("char_hatsune_miku_dakimakura")
    rnd = random.Random(41)
    M = mats(m)
    fab = m.mat("fabric", FABRIC, rough=0.95)
    back = m.mat("fabric_back", "#bfe8e3", rough=0.95)
    H = 0.18
    outline = superellipse(0.8, 0.25, 5, 28)
    top = puff(m, outline, H, fab, back, rnd, lying, hs=0.3, k=5, jit=0.003, name="pillow")
    start = len(m.parts)
    # 絵柄は縦向きに作り、90° 回して頭を -X へ
    miku_flat(m, M, rnd, 0, -0.55, (0.52, 1.1), -0.003, 0.0006, 0.005, jit=0.01, spread=0.5)
    notes(m, M, rnd, [(-0.13, -0.66, 0.06, False), (0.06, -0.7, 0.05, True), (-0.12, 0.56, 0.05, True),
                      (0.1, 0.58, 0.055, False)], -0.003, 0.005)
    lay(m, start, top, lying, rot=math.pi / 2, step=0.06)
    return m


# ---------- 平らな布 ----------

@asset("char_hatsune_miku_blanket.glb", (0.70, 0.008, 1.00))
def char_hatsune_miku_blanket(tint=None):
    """床に広げたブランケット。両端に青緑と灰色の縞、中央に全身のデフォルメ絵柄と音符。"""
    m = Model("char_hatsune_miku_blanket")
    rnd = random.Random(51)
    M = mats(m)
    fab = m.mat("fabric", FABRIC, rough=0.95)
    stripe_t = m.mat("stripe_teal", TEAL, rough=0.95)
    stripe_g = m.mat("stripe_gray", "#9aa3ad", rough=0.95)
    W, D = 0.70, 1.00

    def J(pts, j=0.004):
        return [(x + rnd.uniform(-j, j), y + rnd.uniform(-j, j)) for x, y in pts]

    poly(m, J(rrect(W, D, 0.03, 2), 0.002), 0.0, 0.005, fab, name="blanket")
    z, t = 0.0045, 0.001
    hw = W / 2 - 0.012
    for sy in (-1, 1):
        for y0, y1, mat in ((0.42, 0.45, stripe_t), (0.38, 0.4, stripe_g), (0.34, 0.36, stripe_t)):
            poly(m, J([(-hw, sy * y0), (hw, sy * y0), (hw, sy * y1), (-hw, sy * y1)][::sy], 0.003), z, t, mat,
                 name="stripe")
    miku_flat(m, M, rnd, 0, -0.21, 0.42, z, 0.0002, 0.0012, jit=0.01)
    notes(m, M, rnd, [(-0.27, 0.12, 0.06, False), (0.19, 0.17, 0.05, True), (0.22, -0.2, 0.05, False),
                      (-0.3, -0.22, 0.045, True)], z, 0.0011)
    lay(m, 0, lambda u, v: 0.0, lying)
    return m


@asset("char_hatsune_miku_bed_cover.glb", (1.00, 0.04, 2.00))
def char_hatsune_miku_bed_cover(tint=None):
    """青緑の布団カバー。全体に音符、足元側 (+Z) に白い丸と大きな全身のデフォルメ絵柄。"""
    m = Model("char_hatsune_miku_bed_cover")
    rnd = random.Random(61)
    M = mats(m)
    fab = m.mat("fabric", "#5cc4bb", rough=0.95)
    back = m.mat("fabric_back", "#4aa9a1", rough=0.95)
    patch = m.mat("fabric_patch", FABRIC, rough=0.95)
    light = m.mat("note_light", NOTE_LIGHT, rough=0.95)
    H = 0.034  # 絵柄の厚みの分だけ本体を低くする
    outline = superellipse(0.5, 1.0, 8, 32)
    top = puff(m, outline, H, fab, back, rnd, lying, hs=0.35, k=8, jit=0.002, name="cover")
    start = len(m.parts)
    poly(m, ngon(0, -0.52, 0.34, 0.34, n=14), -0.0035, 0.005, patch, name="patch")
    miku_flat(m, M, rnd, 0, -0.52 - 0.29, 0.6, -0.0025, 0.0006, 0.005, jit=0.01)
    # 音符の柄 (上半分に散らす)
    for row, y in enumerate((-0.05, 0.22, 0.5, 0.78)):
        for col, x in enumerate((-0.32, -0.04, 0.24)):
            xx = x + (0.13 if row % 2 else 0.0) + rnd.uniform(-0.03, 0.03)
            yy = y + rnd.uniform(-0.03, 0.03)
            dbl = (row + col) % 2 == 1
            note(m, M["pink"] if (row + col) % 3 == 0 else light, xx, yy, 0.09, -0.0035, 0.005, rnd, double=dbl)
    lay(m, start, top, lying, step=0.1)
    return m


TAIL = [(-0.27, 0.86), (-0.42, 0.82), (-0.5, 0.66), (-0.52, 0.42), (-0.48, 0.2), (-0.44, 0.05), (-0.36, 0.12),
        (-0.36, 0.36), (-0.34, 0.58), (-0.27, 0.74)]


@asset("char_hatsune_miku_rug.glb", (1.00, 0.02, 1.40))
def char_hatsune_miku_rug(tint=None):
    """青緑の縁のラグ。中央に頭とツインテールの影絵 (青緑) と音符。"""
    m = Model("char_hatsune_miku_rug")
    rnd = random.Random(71)
    M = mats(m)
    trim = m.mat("rug_trim", TEAL, rough=0.95)
    pile = m.mat("rug", FABRIC, rough=1.0)
    W, D, H = 1.00, 1.40, 0.02

    def J(pts, j):
        return [(x + rnd.uniform(-j, j), y + rnd.uniform(-j, j)) for x, y in pts]

    poly(m, J(rrect(W, D, 0.06, 2), 0.003), 0.0, 0.012, trim, name="trim")
    poly(m, J(rrect(W - 0.08, D - 0.08, 0.04, 2), 0.003), 0.006, 0.01, pile, name="pile")
    z, dz, t = 0.0145, 0.0004, 0.0025
    S, oy = 0.78, -0.36

    def P(pts, layer, mat, name, j=0.008):
        poly(m, [(x * S + rnd.uniform(-j, j), oy + y * S + rnd.uniform(-j, j)) for x, y in pts], z + layer * dz, t,
             mat, name=name)

    for sx in (-1, 1):
        P([(sx * x, y) for x, y in (TAIL if sx < 0 else reversed(TAIL))], 0, M["hair"], "motif_tail")
    P(ngon(0, 0.71, 0.29, 0.28, n=8, rot=math.pi / 8), 0, M["hair"], "motif_head")
    for sx in (-1, 1):
        P(ngon(sx * 0.29, 0.85, 0.045, 0.06, n=5), 1, M["hairtie"], "motif_hair_tie", j=0.003)
        P(ngon(sx * 0.305, 0.85, 0.015, 0.03, n=4), 2, M["pink"], "motif_hair_tie_accent", j=0.002)
    notes(m, M, rnd, [(-0.36, 0.5, 0.09, False), (0.22, 0.48, 0.08, True), (0.3, -0.5, 0.085, False),
                      (-0.38, -0.48, 0.075, True), (-0.06, -0.48, 0.06, False)], z, t)
    lay(m, 0, lambda u, v: 0.0, lying)
    return m


# ---------- ぬいぐるみ ----------

def _arm(m, M, rnd, sh, hand, s=1.0):
    """肩 sh から手 hand への腕 (肌の上腕・離れた袖・青緑の縁・手)。"""
    sh, hand = Vector(sh), Vector(hand)
    mid = sh.lerp(hand, 0.3)
    d = (hand - mid).normalized()
    lump(m, sh, (0.011 * s,) * 3, M["skin"], rnd, seg=6, rings=4, name="shoulder")
    cone(m, mid, hand, 0.012 * s, 0.017 * s, M["top"], rnd, seg=6, jit=0.06, name="sleeve")
    cone(m, mid - d * 0.002 * s, mid + d * 0.005 * s, 0.0135 * s, 0.0135 * s, M["trim"], rnd, seg=6, jit=0.02,
         name="sleeve_cuff")
    cone(m, sh, mid, 0.008 * s, 0.009 * s, M["skin"], rnd, seg=5, jit=0.0, name="upper_arm")
    lump(m, hand + d * 0.006 * s, (0.009 * s,) * 3, M["skin"], rnd, seg=5, rings=4, name="hand")


LYING_TAILS = [(0.95, 0.62, -0.2, 0.22), (1.05, 0.4, -0.55, 0.27), (1.05, -0.1, -1.1, 0.28), (1.0, -0.45, -1.7, 0.26),
               (0.95, -0.6, -2.3, 0.2), (0.9, -0.62, -2.8, 0.12), (0.88, -0.62, -3.05, 0.0)]


@asset("char_hatsune_miku_plush_lying.glb", (0.30, 0.14, 0.16))
def char_hatsune_miku_plush_lying(tint=None):
    """うつ伏せに寝そべったぬいぐるみ。頭が +X、ツインテールは体の両脇へ流す。顔は少し手前へ向ける。"""
    m = Model("char_hatsune_miku_plush_lying")
    m.tol = 0.15
    rnd = random.Random(81)
    M = mats(m)
    R = 0.064
    hc = Vector((0, 0.98 * R, 0))
    # 頭 (ローカルでは顔が +Z、体が -Z)
    head3d(m, M, rnd, hc, R, LYING_TAILS, zs=0.85)
    turn = Matrix.Translation(hc) @ Matrix.Rotation(math.radians(-20), 4, "Y") @ Matrix.Translation(-hc)
    for ob in m.parts:
        m.apply(ob)
        ob.data.transform(turn)
    # 胴・スカート・脚 (後ろへ伸ばす)
    lump(m, (0, 0.032, -0.08), (0.042, 0.03, 0.05), M["top"], rnd, name="torso")
    cone(m, (0, 0.05, -0.04), (0, 0.04, -0.075), 0.007, 0.002, M["tie"], rnd, seg=4, jit=0.05, name="tie")
    lump(m, (0, 0.03, -0.13), (0.05, 0.028, 0.035), M["skirt"], rnd, name="skirt")
    lump(m, (0, 0.03, -0.16), (0.05, 0.026, 0.008), M["trim"], rnd, seg=7, rings=4, jit=0.03, name="skirt_trim")
    for sx in (-1, 1):
        k0 = Vector((sx * 0.022, 0.02, -0.15))
        k1 = Vector((sx * 0.025, 0.018, -0.185))
        foot = Vector((sx * 0.027, 0.018, -0.222))
        cone(m, k0, k1, 0.014, 0.013, M["skin"], rnd, seg=6, jit=0.05, name="thigh")
        cone(m, k1, foot, 0.015, 0.016, M["boots"], rnd, seg=6, jit=0.05, name="boot")
        cone(m, foot, foot + Vector((0, 0, -0.006)), 0.016, 0.014, M["trim"], rnd, seg=6, jit=0.03, name="sole")
        _arm(m, M, rnd, (sx * 0.04, 0.045, -0.055), (sx * 0.056, 0.016, 0.012))
    rot = Matrix.Rotation(math.pi / 2, 4, "Y")
    for ob in m.parts:
        m.apply(ob)
        ob.data.transform(rot)
    return m


@asset("char_hatsune_miku_plush_negi.glb", (0.22, 0.24, 0.14))
def char_hatsune_miku_plush_negi(tint=None):
    """座ったぬいぐるみが、右腕に長ネギを抱える。"""
    m = _plush("char_hatsune_miku_plush_negi", 1.0, 39)
    rnd = random.Random(91)
    M = mats(m)
    # 右腕 (+X) を外し、ネギを抱える腕に付け替える
    arm = {"sleeve", "sleeve_cuff", "upper_arm", "hand"}
    drop = []
    for ob in m.parts:
        if ob.name.split(".")[0] in arm:
            vs = ob.data.vertices
            if sum(v.co.x for v in vs) / len(vs) > 0:
                drop.append(ob)
    for ob in drop:
        m.parts.remove(ob)
        me = ob.data
        bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.meshes.remove(me)
    _arm(m, M, rnd, (0.03, 0.089, 0.0), (0.062, 0.098, 0.042))
    white = m.mat("negi_white", "#eef2df", rough=0.9)
    pale = m.mat("negi_light", "#a6cf62", rough=0.9)
    green = m.mat("negi_green", "#4f9a3a", rough=0.9)
    root = m.mat("negi_root", "#d8cba6", rough=0.9)
    A = Vector((0.058, 0.008, 0.074))
    B = Vector((0.09, 0.2, 0.03))

    def P(t):
        return A.lerp(B, t)

    cone(m, P(0.0), P(0.36), 0.0105, 0.011, white, rnd, seg=6, jit=0.04, name="negi_white")
    cone(m, P(0.34), P(0.6), 0.011, 0.0105, pale, rnd, seg=6, jit=0.04, name="negi_light")
    cone(m, P(0.58), B + Vector((0.006, 0.03, -0.004)), 0.0095, 0.0015, green, rnd, seg=5, jit=0.06,
         name="negi_leaf")
    cone(m, P(0.6), Vector((0.122, 0.218, 0.026)), 0.007, 0.0012, green, rnd, seg=5, jit=0.06, name="negi_leaf")
    cone(m, P(0.62), Vector((0.07, 0.205, -0.004)), 0.006, 0.0012, green, rnd, seg=5, jit=0.06, name="negi_leaf")
    for dx, dz in ((-0.006, 0.004), (0.005, 0.006), (0.0, -0.005)):
        cone(m, A + Vector((0, 0.004, 0)), A + Vector((dx, -0.006, dz + 0.004)), 0.003, 0.0006, root, rnd, seg=4,
             jit=0.05, name="negi_root")
    return m


# ---------- PCクッション ----------

PC_TAILS = [(0.95, 0.62, -0.2, 0.22), (1.25, 0.5, -0.3, 0.32), (1.4, 0.1, -0.4, 0.36), (1.45, -0.5, -0.5, 0.33),
            (1.4, -1.2, -0.6, 0.27), (1.35, -1.8, -0.7, 0.2), (1.3, -2.0, -0.85, 0.12), (1.26, -2.02, -1.0, 0.0)]


@asset("char_hatsune_miku_pc_cushion.glb", (0.55, 0.47, 0.30))
def char_hatsune_miku_pc_cushion(tint=None):
    """うつ伏せで上体を起こしたぬいぐるみ型の机用クッション。手前の長い枕に両腕を乗せ、足は後ろで上げる。"""
    m = Model("char_hatsune_miku_pc_cushion")
    m.tol = 0.15
    rnd = random.Random(17)
    M = mats(m)
    bol = m.mat("bolster", FABRIC, rough=0.95)
    L, r, zc = 0.55, 0.07, 0.075
    cone(m, (-L / 2 + 0.024, r, zc), (L / 2 - 0.024, r, zc), r, r, bol, rnd, seg=8, jit=0.03, name="bolster")
    for sx in (-1, 1):
        cone(m, (sx * (L / 2 - 0.026), r, zc), (sx * L / 2, r, zc), r * 0.98, r * 0.88, M["trim"], rnd, seg=8,
             jit=0.02, name="bolster_end")
    # 胴 (頭の下で上体を起こす)・スカート・後ろで上げた脚
    lump(m, (0, 0.11, -0.04), (0.075, 0.075, 0.075), M["top"], rnd, name="torso")
    lump(m, (0, 0.06, -0.105), (0.085, 0.05, 0.06), M["skirt"], rnd, name="skirt")
    lump(m, (0, 0.06, -0.15), (0.085, 0.045, 0.012), M["trim"], rnd, seg=7, rings=4, jit=0.03, name="skirt_trim")
    for sx in (-1, 1):
        k0 = Vector((sx * 0.035, 0.04, -0.13))
        k1 = Vector((sx * 0.042, 0.03, -0.165))
        foot = Vector((sx * 0.046, 0.15, -0.135))
        cone(m, k0, k1, 0.024, 0.022, M["skin"], rnd, seg=6, jit=0.05, name="thigh")
        cone(m, k1, foot, 0.023, 0.025, M["boots"], rnd, seg=6, jit=0.05, name="boot")
        cone(m, foot, foot + Vector((0, 0.012, 0.004)), 0.025, 0.022, M["trim"], rnd, seg=6, jit=0.03, name="sole")
        _arm(m, M, rnd, (sx * 0.068, 0.145, -0.005), (sx * 0.115, 0.152, 0.095), s=1.8)
    R = 0.14
    head3d(m, M, rnd, (0, 0.313, 0.0), R, PC_TAILS, zs=0.9)
    return m
