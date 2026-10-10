"""推し活グッズのテンプレート (キャラクターなし)。印刷面は素材名 print、色替えする本体・枠は tint。
正面 +Z。壁掛け・立てかけるものは背面 -Z が平ら。"""
import math

import bmesh
import palette as P
from lib import Model, asset, rot_matrix, rrect
from mathutils import Matrix, Vector
from mathutils.geometry import tessellate_polygon

PRINT = "#f3efe9"     # 印刷前の白地 (soften で暖かい灰色寄りになる)
ACRYLIC = "#e6eef6"


def scale_all(m, sx, sy, sz):
    """全部品を原点基準で伸縮する (体型を目標寸法の比率へ合わせる)。"""
    for ob in m.parts:
        m.apply(ob)
        ob.data.transform(Matrix.Diagonal((sx, sy, sz, 1.0)))


def slab(m, pts, z0, t, mat, name="slab"):
    """正面図 (x, y) の任意の多角形 (凹みも可) を z0 から +Z へ厚み t で押し出す。"""
    bm = bmesh.new()
    back = [bm.verts.new((x, y, z0)) for x, y in pts]
    front = [bm.verts.new((x, y, z0 + t)) for x, y in pts]
    for tri in tessellate_polygon([[Vector((x, y, 0)) for x, y in pts]]):
        bm.faces.new([front[i] for i in tri])
        bm.faces.new([back[i] for i in reversed(tri)])
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((back[i], back[j], front[j], front[i]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return m._obj(bm, mat, name)


def rounded_top(w, h, r, y0=0.0, seg=8):
    """下が角、上が角丸の板 (x, y)。反時計回り。"""
    pts = [(-w / 2, y0), (w / 2, y0)]
    for cx, a0 in ((w / 2 - r, 0), (-w / 2 + r, 90)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), y0 + h - r + r * math.sin(a)))
    return pts


def pillow(m, outline, t, front_mat, back_mat, side=0.3, rings=6, name="pillow"):
    """星形の輪郭 (x, y) から、前後に膨らんだクッションを作る。前面 front_mat、背面と側面 back_mat。
    side: 厚み t のうち、平らな側面の割合。"""
    cx = sum(p[0] for p in outline) / len(outline)
    cy = sum(p[1] for p in outline) / len(outline)
    n = len(outline)
    hs = t * side / 2
    puff = t / 2 - hs
    for sgn, mat in ((1, front_mat), (-1, back_mat)):
        bm = bmesh.new()
        grid = []
        for k in range(rings):
            s = 1 - k / rings
            z = sgn * (hs + puff * math.sqrt(max(0.0, 1 - s * s)) ** 0.8)
            grid.append([bm.verts.new((cx + (x - cx) * s, cy + (y - cy) * s, z)) for x, y in outline])
        tip = bm.verts.new((cx, cy, sgn * (hs + puff)))
        for k in range(rings - 1):
            for i in range(n):
                j = (i + 1) % n
                bm.faces.new((grid[k][i], grid[k][j], grid[k + 1][j], grid[k + 1][i]))
        for i in range(n):
            bm.faces.new((grid[-1][i], grid[-1][(i + 1) % n], tip))
        if sgn < 0:  # 輪郭は反時計回りなので、背面は裏返す
            bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
        ob = m._obj(bm, mat, name + ("_front" if sgn > 0 else "_back"))
        ob.data.shade_smooth()
    # 側面の帯
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, -hs)) for x, y in outline]
    hi = [bm.verts.new((x, y, hs)) for x, y in outline]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    ob = m._obj(bm, back_mat, name + "_side")
    ob.data.shade_smooth()


# ---------- アクリルスタンド ----------

def _acrylic_stand(name, W, H, D):
    m = Model(name)
    acr = m.mat("acrylic", ACRYLIC, rough=0.08, alpha=0.4)
    prt = m.mat("print", PRINT, rough=0.8)
    bt = max(0.004, H * 0.04)              # 台座の厚み
    m.prism(rrect(W, D, min(W, D) * 0.18), bt, acr, plane="xz", offset=0.0, bevel=bt * 0.25, name="base")
    bw = W * 0.86                            # 板の幅
    th = 0.003 if H < 0.25 else 0.004       # 板の厚み
    board = rounded_top(bw, H - bt, bw * 0.22, y0=bt)
    m.prism(board, th, acr, plane="xy", offset=-th / 2, bevel=0.0008, name="board")
    # 差し込みの爪 (台座の溝に入る部分)
    m.box((bw * 0.35, bt * 0.9, th), (0, bt * 0.45, 0), acr, bevel=0.0, name="tab")
    # 印刷層 (板の中に挟まれた絵柄の白地)
    inset = bw * 0.06
    layer = rounded_top(bw - 2 * inset, H - bt - 2 * inset, (bw - 2 * inset) * 0.2, y0=bt + inset)
    slab(m, layer, -0.0004, 0.0008, prt, name="print_layer")
    # 台座の溝の縁
    m.box((bw * 0.45, bt * 0.25, th * 2.6), (0, bt + bt * 0.12, 0), acr, bevel=0.0, name="slot_rim")
    return m


@asset("acrylic_stand_s.glb", (0.07, 0.10, 0.05))
def acrylic_stand_s(tint=None):
    return _acrylic_stand("acrylic_stand_s", 0.07, 0.10, 0.05)


@asset("acrylic_stand_m.glb", (0.09, 0.15, 0.06))
def acrylic_stand_m(tint=None):
    return _acrylic_stand("acrylic_stand_m", 0.09, 0.15, 0.06)


@asset("acrylic_stand_l.glb", (0.12, 0.20, 0.07))
def acrylic_stand_l(tint=None):
    return _acrylic_stand("acrylic_stand_l", 0.12, 0.20, 0.07)


@asset("acrylic_stand_big.glb", (0.18, 0.30, 0.10))
def acrylic_stand_big(tint=None):
    return _acrylic_stand("acrylic_stand_big", 0.18, 0.30, 0.10)


# ---------- タペストリー ----------

def _tapestry(name, W, H, D, tint=None):
    """上下に棒を通した布。上の棒の両端から紐を山形に掛ける (紐の頂点が全高)。"""
    m = Model(name)
    cloth = m.mat("print", PRINT, rough=0.95)
    rod = m.mat("tint", tint or "#5a5566", rough=0.6)
    cord = m.mat("string", "#8f8799", rough=0.9)
    r = D / 2                              # 棒の半径 (奥行きいっぱい)
    loop = H * 0.07                        # 紐の山の高さ
    top = H - loop - r                     # 上の棒の中心
    bot = r
    cw = W - 0.03                          # 棒は布より少し長い
    t = 0.0025

    def fn(u, v):
        x = (u - 0.5) * cw
        y = bot + v * (top - bot)
        z = -0.0015 * math.sin(math.pi * u) * math.sin(math.pi * v)
        return (x, y, z)

    m.surface(25, 20, fn, cloth, thickness=t, name="cloth")
    for y in (top, bot):
        m.cyl(r, W, (0, y, 0), rod, seg=16, axis="x", name="rod")
        for sx in (-1, 1):
            m.cyl(r * 1.15, 0.008, (sx * (W / 2 - 0.004), y, 0), rod, seg=16, axis="x", name="rod_cap")
    # 紐: 棒の両端から頂点へ
    peak = (0, H - 0.0015, 0)
    for sx in (-1, 1):
        m.rod((sx * (W / 2 - 0.012), top + r * 0.6, 0), peak, 0.0015, cord, seg=6, name="string")
    return m


@asset("tapestry_b2.glb", (0.515, 0.728, 0.015))
def tapestry_b2(tint=None):
    return _tapestry("tapestry_b2", 0.515, 0.728, 0.015, tint)


@asset("tapestry_b1.glb", (0.728, 1.03, 0.015))
def tapestry_b1(tint=None):
    return _tapestry("tapestry_b1", 0.728, 1.03, 0.015, tint)


# ---------- ぬいぐるみの素体 ----------

def _plush_base(name, W, H, D, tint=None):
    """座ったデフォルメ人形の素体。大きな丸い頭・小さな胴・短い手足。髪や耳は付けない。
    基準寸法 0.25×0.40×0.20 で組み、目標寸法の比率へ伸縮する。"""
    m = Model(name)
    m.tol = 0.15
    fab = m.mat("tint", tint or "#f0c4aa", rough=0.95)
    face = m.mat("print", PRINT, rough=0.95)
    # 胴 (座った洋なし形)
    m.lathe([(0.0, 0.0), (0.06, 0.004), (0.075, 0.03), (0.07, 0.07), (0.055, 0.11), (0.035, 0.14), (0.0, 0.15)],
            (0, 0, 0), fab, seg=28, name="body")
    # 頭 (大きく、少し横長)
    hc = (0, 0.27, 0.0)
    m.sphere(1, hc, fab, seg=32, rings=16, scale=(0.125, 0.12, 0.1), name="head")
    # 顔の印刷面 (頭の正面に沿う浅い楕円体)
    m.sphere(1, (0, 0.26, 0.074), face, seg=24, rings=12, scale=(0.08, 0.066, 0.03), name="face")
    for sx in (-1, 1):
        # 腕 (前へ少し出した短い腕)
        ob = m.sphere(1, (0, 0, 0), fab, seg=16, rings=8, scale=(0.028, 0.05, 0.03), name="arm")
        ob.data.transform(Matrix.Translation((sx * 0.08, 0.085, 0.03)) @ rot_matrix((25, 0, sx * 35)))
        # 脚 (前へ投げ出す)
        ob = m.sphere(1, (0, 0, 0), fab, seg=16, rings=8, scale=(0.034, 0.03, 0.055), name="leg")
        ob.data.transform(Matrix.Translation((sx * 0.042, 0.028, 0.055)))
    # 伸縮: 基準 0.25×0.40×0.20 前後で組んだ形を目標比率へ
    xs, ys, zs = [], [], []
    for ob in m.parts:
        m.apply(ob)
        for v in ob.data.vertices:
            xs.append(v.co.x)
            ys.append(v.co.y)
            zs.append(v.co.z)
    scale_all(m, W / (max(xs) - min(xs)), H / (max(ys) - min(ys)), D / (max(zs) - min(zs)))
    return m


@asset("plush_base_s.glb", (0.13, 0.20, 0.11))
def plush_base_s(tint=None):
    return _plush_base("plush_base_s", 0.13, 0.20, 0.11, tint)


@asset("plush_base_m.glb", (0.25, 0.40, 0.20))
def plush_base_m(tint=None):
    return _plush_base("plush_base_m", 0.25, 0.40, 0.20, tint)


@asset("plush_base_l.glb", (0.40, 0.55, 0.25))
def plush_base_l(tint=None):
    return _plush_base("plush_base_l", 0.40, 0.55, 0.25, tint)


# ---------- ダイカットクッション ----------

@asset("cushion_diecut.glb", (0.40, 0.45, 0.12))
def cushion_diecut(tint=None):
    """輪郭を丸く切り抜いたクッション。前面が印刷面、背面と側面が無地。背面を床側に立てて置く。"""
    m = Model("cushion_diecut")
    m.tol = 0.1
    prt = m.mat("print", PRINT, rough=0.95)
    fab = m.mat("tint", tint or "#e8d6e6", rough=0.95)
    W, H = 0.40, 0.45
    n = 64
    outline = []
    for i in range(n):
        a = math.tau * i / n
        # 上が少し大きい、ゆるく波打つ輪郭
        r = 1 + 0.05 * math.sin(3 * a + 0.6) + 0.035 * math.cos(5 * a)
        x = W / 2 * 0.93 * r * math.cos(a)
        y = H / 2 * 0.93 * r * math.sin(a) * (1.05 if math.sin(a) > 0 else 0.97)
        outline.append((x, y + H / 2))
    pillow(m, outline, 0.12, prt, fab, side=0.35, rings=8)
    return m


# ---------- 缶バッジ ----------

@asset("can_badge.glb", (0.057, 0.057, 0.012))
def can_badge(tint=None):
    """丸い缶バッジ1個を小さな透明イーゼルに立てる。前面のドームが印刷面。"""
    m = Model("can_badge")
    prt = m.mat("print", PRINT, rough=0.45)
    rim = m.mat("tint", tint or "#c9c1d8", rough=0.6)
    acr = m.mat("acrylic", ACRYLIC, rough=0.08, alpha=0.4)
    r = 0.0285
    cy = r
    z0 = -0.0005
    back = [(0.0, 0.0), (r * 0.98, 0.0), (r, 0.0025), (r * 0.965, 0.004)]
    dome = [(r * 0.965, 0.004), (r * 0.85, 0.0056), (r * 0.6, 0.0066), (r * 0.3, 0.0071), (0.0, 0.0072)]
    for prof, mat, nm in ((back, rim, "badge_back"), (dome, prt, "badge_face")):
        ob = m.lathe(prof, (0, 0, 0), mat, seg=40, cap_bottom=(nm == "badge_back"), cap_top=False, name=nm)
        m.apply(ob)
        ob.data.transform(Matrix.Translation((0, cy, z0)) @ rot_matrix((90, 0, 0)))
    # イーゼル: 背面の支え板と前の受け
    t = 0.0015
    m.box((0.026, 0.004, 0.011), (0, 0.002, 0.0), acr, bevel=0.0, name="easel_foot")
    m.box((0.018, 0.035, t), (0, 0.0175, -0.0028), acr, bevel=0.0, rot=(-5, 0, 0), name="easel_back")
    m.box((0.026, 0.006, t), (0, 0.003, 0.0058), acr, bevel=0.0, name="easel_lip")
    return m


# ---------- ラバーマット ----------

@asset("rubber_mat.glb", (0.60, 0.003, 0.30))
def rubber_mat(tint=None):
    """角丸のラバーマット。上面が印刷面、底のゴム層が tint。"""
    m = Model("rubber_mat")
    rub = m.mat("tint", tint or "#4d4868", rough=0.95)
    prt = m.mat("print", PRINT, rough=0.9)
    m.prism(rrect(0.60, 0.30, 0.02), 0.0022, rub, plane="xz", offset=0.0, name="rubber")
    m.prism(rrect(0.598, 0.298, 0.019), 0.0008, prt, plane="xz", offset=0.0022, name="print_top")
    return m


# ---------- ブランケット ----------

@asset("blanket_print.glb", (0.70, 0.008, 1.00))
def blanket_print(tint=None):
    """床に広げたプリントブランケット。上面が印刷面、縁取りが tint。"""
    m = Model("blanket_print")
    edge = m.mat("tint", tint or "#d9c8e4", rough=0.95)
    prt = m.mat("print", PRINT, rough=0.95)
    W, D = 0.70, 1.00
    m.prism(rrect(W, D, 0.04), 0.006, edge, plane="xz", offset=0.0, bevel=0.002, name="hem")

    def fn(u, v):
        x = (u - 0.5) * (W - 0.04)
        z = (v - 0.5) * (D - 0.04)
        y = 0.0065 + 0.0006 * math.sin(u * math.pi * 3) * math.sin(v * math.pi * 4)
        return (x, y, z)

    m.surface(15, 21, fn, prt, thickness=0.0016, name="print_top")
    return m


# ---------- アクリルパネル ----------

@asset("acrylic_panel.glb", (0.15, 0.20, 0.06))
def acrylic_panel(tint=None):
    """厚いアクリル板を溝付きの透明台座に立てる。板の中に印刷層を挟む。"""
    m = Model("acrylic_panel")
    acr = m.mat("acrylic", ACRYLIC, rough=0.08, alpha=0.4)
    prt = m.mat("print", PRINT, rough=0.8)
    W, H, D = 0.15, 0.20, 0.06
    bh = 0.012
    m.box((W, bh, D), (0, bh / 2, 0), acr, bevel=0.003, name="base")
    t = 0.015
    ph = H - bh + 0.006
    m.box((W - 0.004, ph, t), (0, bh - 0.006 + ph / 2, 0), acr, bevel=0.0025, name="panel")
    m.box((W - 0.016, ph - 0.022, 0.0008), (0, bh + (ph - 0.006) / 2, 0), prt, bevel=0.0, name="print_layer")
    return m
