"""追加の椅子・ソファ・テーブル 第2弾 (2026-10-05)。"""
import math

import bmesh
from mathutils import Vector

import palette as P
from lib import Model, asset, rrect
from models_tables import apron, round_legs, tapered_legs, top_rect


# ---------- 補助 ----------

def _tube(m, pts, r, mat, seg=10, name="tube"):
    """折れ線 pts (3D) に沿った丸パイプ。曲げ木やフレームに使う。"""
    pts = [Vector(p) for p in pts]
    n = len(pts)
    bm = bmesh.new()
    rings = []
    normal = None
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        if normal is None:
            ref = Vector((0, 1, 0)) if abs(t.y) < 0.9 else Vector((1, 0, 0))
            normal = t.cross(ref).normalized()
        else:  # 前の向きを引き継いでねじれを防ぐ
            normal = (normal - t * normal.dot(t)).normalized()
        binormal = t.cross(normal)
        rings.append([bm.verts.new(p + (normal * math.cos(a) + binormal * math.sin(a)) * r)
                      for a in (math.tau * k / seg for k in range(seg))])
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(seg):
            bm.faces.new((r0[k], r0[(k + 1) % seg], r1[(k + 1) % seg], r1[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return m._obj(bm, mat, name)


def _loft(m, rings, mat, cap_lift=(0.0, 0.0), smooth=True, name="loft"):
    """rings: 下から上への (上面図の輪郭 [(x, z)...], y) 列。点数は揃える。
    上下の面は中心から扇で閉じ、cap_lift で中心を膨らませる (下, 上)。"""
    bm = bmesh.new()
    vs = [[bm.verts.new((x, y, z)) for x, z in pts] for pts, y in rings]
    k = len(vs[0])
    for lo, hi in zip(vs, vs[1:]):
        for i in range(k):
            j = (i + 1) % k
            bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    for ring, (pts, y), lift, up in ((vs[0], rings[0], cap_lift[0], False), (vs[-1], rings[-1], cap_lift[1], True)):
        cx = sum(p[0] for p in pts) / k
        cz = sum(p[1] for p in pts) / k
        c = bm.verts.new((cx, y + (lift if up else -lift), cz))
        for i in range(k):
            j = (i + 1) % k
            bm.faces.new((ring[i], ring[j], c) if up else (ring[j], ring[i], c))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = m._obj(bm, mat, name)
    if smooth:
        ob.data.set_sharp_from_angle(angle=math.pi)
    return ob


def _tufted_panel(m, w, h, mat, buttons, place, depth=0.028, sigma=0.032, puff=0.012, nu=40, nv=14,
                  name="tufted"):
    """ボタン留めの布面。面内座標 (u: 横, v: 縦) にくぼみを付け、place(u, v, n) で3Dへ置く (n は手前方向の量)。"""
    def fn(a, b):
        u, v = (a - 0.5) * w, (b - 0.5) * h
        dent = min(1.0, sum(math.exp(-((u - bu) ** 2 + (v - bv) ** 2) / (2 * sigma * sigma)) for bu, bv in buttons))
        edge = min(1.0, (w / 2 - abs(u)) / 0.04, (h / 2 - abs(v)) / 0.04)
        return place(u, v, puff * max(edge, 0.0) - depth * dent)

    ob = m.surface(nu, nv, fn, mat, thickness=0.012, name=name)
    m.apply(ob)
    ob.data.set_sharp_from_angle(angle=math.pi)
    return ob


def _diamond(xs0, xs1, ys):
    """互い違いのボタン配置。ys の偶数行は xs0、奇数行は xs1。"""
    return [(x, y) for i, y in enumerate(ys) for x in (xs0 if i % 2 == 0 else xs1)]


# ---------- ソファ ----------

@asset("sofa_wood_frame.glb", (1.40, 0.75, 0.75))
def sofa_wood_frame(tint=None):
    """木枠がむき出しのソファ。肘掛け・背の柱が木、座と背はクッション。"""
    m = Model("sofa_wood_frame")
    fab = m.mat("tint", tint or "#b8c4a8", rough=0.95)
    wood = m.mat("wood", P.WOOD_MED, rough=0.55)
    W, D = 1.40, 0.75
    xa = W / 2 - 0.03
    zf, zb = D / 2 - 0.04, -D / 2 + 0.03
    for sx in (-1, 1):
        x = sx * xa
        m.box((0.045, 0.56, 0.045), (x, 0.28, zf), wood, bevel=0.006, name="front_post")
        m.box((0.05, 0.74, 0.05), (x, 0.37, zb), wood, bevel=0.006, rot=(-4, 0, 0), name="rear_post")
        m.box((0.07, 0.035, D - 0.03), (sx * (W / 2 - 0.035), 0.585, 0.0), wood, bevel=0.01, name="armrest")
        m.box((0.035, 0.06, D - 0.1), (x, 0.20, -0.01), wood, bevel=0.005, name="side_rail")
        for z in (-0.17, 0.0, 0.17):  # 肘下の縦格子
            m.box((0.022, 0.33, 0.026), (x, 0.395, z), wood, bevel=0.004, name="arm_slat")
    m.box((W - 0.06, 0.07, 0.04), (0, 0.20, zf), wood, bevel=0.006, name="front_rail")
    m.box((W - 0.06, 0.07, 0.04), (0, 0.20, zb + 0.01), wood, bevel=0.006, name="back_rail")
    m.box((W - 0.07, 0.05, 0.035), (0, 0.69, zb - 0.02), wood, bevel=0.008, rot=(-6, 0, 0), name="top_rail")
    m.box((W - 0.1, 0.02, D - 0.1), (0, 0.24, -0.01), wood, bevel=0.003, name="deck")
    for i in range(7):  # 背の縦格子 (後ろから見ても木枠に見えるように)
        x = -0.54 + 0.18 * i
        m.box((0.04, 0.45, 0.018), (x, 0.455, zb - 0.002), wood, bevel=0.004, rot=(-5, 0, 0), name="back_slat")
    # 座クッション (1枚) と背クッション (2個)
    m.cushion((W - 0.12, 0.15, 0.60), (0, 0.32, 0.04), fab, puff=0.22, round_=0.32, cuts=4, name="seat")
    for sx in (-1, 1):
        m.cushion((0.615, 0.36, 0.14), (sx * 0.31, 0.555, -0.235), fab, puff=0.25, round_=0.32, cuts=4,
                  rot=(-11, 0, 0), name="back")
    return m


@asset("sofa_chesterfield.glb", (1.80, 0.75, 0.85))
def sofa_chesterfield(tint=None):
    """背と同じ高さのロールアーム、ボタン留めの背もたれ。"""
    m = Model("sofa_chesterfield")
    fab = m.mat("tint", tint or "#9fb5a7", rough=0.95)
    btn = m.mat("button", "#6f8a7c", rough=0.9)
    wood = m.mat("wood", P.WOOD_BROWN, rough=0.6)
    W, D = 1.80, 0.85
    leg_h, r = 0.06, 0.085
    arm_w = 0.19
    xi = W / 2 - arm_w  # 袖の内側
    # 丸い脚
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.lathe([(0.0, 0.0), (0.026, 0.0), (0.034, 0.02), (0.034, 0.04), (0.028, leg_h), (0.0, leg_h)],
                    (sx * (W / 2 - 0.1), 0, sz * (D / 2 - 0.09)), wood, seg=14, name="bun_foot")
    # 台座
    m.box((2 * xi + 0.02, 0.26, D - 0.02), (0, leg_h + 0.13, 0.0), fab, bevel=0.03, seg=3, name="base")
    # 背もたれ (前面にボタンのくぼみ)
    zb0, bd = -D / 2, 0.19
    top_y = 0.75 - r
    bw, by0, by1 = 2 * xi + 0.02, 0.33, top_y + 0.03
    fz = zb0 + bd - 0.012  # ボタン面の基準。箱はその奥に置く
    m.box((bw, top_y - leg_h, bd - 0.05), (0, (top_y + leg_h) / 2, zb0 + (bd - 0.05) / 2), fab, bevel=0.03, seg=3,
          name="back")
    m.cyl(r, bw, (0, top_y, zb0 + r + 0.005), fab, seg=20, axis="x", bevel=0.03, bseg=3, name="back_roll")
    bh, bc = by1 - by0, (by0 + by1) / 2
    back_buttons = _diamond([-0.6, -0.4, -0.2, 0.0, 0.2, 0.4, 0.6], [-0.5, -0.3, -0.1, 0.1, 0.3, 0.5],
                            [0.0, 0.11, 0.22])
    back_buttons = [(u, v - bh / 2 + 0.06) for u, v in back_buttons]
    _tufted_panel(m, bw - 0.01, bh, fab, back_buttons, lambda u, v, n: (u, bc + v, fz + n), nu=42, nv=12,
                  name="back_tufted")
    for u, v in back_buttons:
        m.sphere(0.014, (u, bc + v, fz - 0.014), btn, seg=6, rings=4, name="button")
    # 袖: 箱 + 外へ巻いたロール。内側にもボタン
    for sx in (-1, 1):
        aw = arm_w - 0.04
        xc = sx * (W / 2 - arm_w / 2 - 0.01)
        fx = xc - sx * aw / 2  # 袖の内側の面
        m.box((aw - 0.03, top_y - leg_h, D - 0.02), (xc + sx * 0.015, (top_y + leg_h) / 2, 0.0), fab, bevel=0.03,
              seg=3, name="arm")
        m.cyl(r + 0.005, D - 0.01, (sx * (W / 2 - r - 0.005), top_y, 0.0), fab, seg=20, axis="z", bevel=0.03, bseg=3,
              name="arm_roll")
        m.cyl(r - 0.012, 0.012, (sx * (W / 2 - r - 0.005), top_y, D / 2 - 0.004), btn, seg=20, axis="z",
              bevel=0.004, name="arm_scroll")
        aw_, az = D - bd + 0.0, (bd - 0.012) / 2
        arm_buttons = [(u - 0.05, v - bh / 2 + 0.06) for u, v in _diamond([-0.2, 0.0, 0.2], [-0.1, 0.1], [0.0, 0.11, 0.22])]
        _tufted_panel(m, aw_, bh, fab, arm_buttons,
                      (lambda s_, f_: (lambda u, v, n: (f_ - s_ * n, bc + v, az + u)))(sx, fx),
                      nu=17, nv=12, name="arm_tufted")
        for u, v in arm_buttons:
            m.sphere(0.014, (fx + sx * 0.014, bc + v, az + u), btn, seg=6, rings=4, name="button")
    # 座クッション (3枚)
    sw = 2 * xi / 3
    for i in range(3):
        m.cushion((sw - 0.01, 0.14, D - bd - 0.02), (-xi + sw * (i + 0.5), 0.375, zb0 + bd + (D - bd) / 2 - 0.012),
                  fab, puff=0.2, round_=0.3, cuts=3, name="seat")
    return m


@asset("sofa_cloud.glb", (2.00, 0.70, 0.95))
def sofa_cloud(tint=None):
    """もこもこのクラウドソファ。脚は見せず、丸く膨らんだ大きなクッションで組む。"""
    m = Model("sofa_cloud")
    fab = m.mat("tint", tint or "#ebe1d3", rough=0.95)
    shade = m.mat("fabric_base", "#d9cbb8", rough=0.95)
    W, D = 2.00, 0.95
    arm_w = 0.32
    xi = W / 2 - arm_w + 0.03
    # 台座と背の土台
    m.cushion((2 * xi + 0.04, 0.24, D - 0.04), (0, 0.12, 0.01), shade, puff=0.15, round_=0.4, cuts=4, name="base")
    m.cushion((2 * xi + 0.06, 0.58, 0.30), (0, 0.29, -D / 2 + 0.15), fab, puff=0.2, round_=0.45, cuts=4, pinch=0.04,
              name="back_frame")
    # ぽってりした袖
    for sx in (-1, 1):
        m.cushion((arm_w, 0.54, D), (sx * (W / 2 - arm_w / 2), 0.27, 0.0), fab, puff=0.25, round_=0.48, cuts=4,
                  pinch=0.06, name="arm")
    # 座 (2枚) と背クッション (2個)
    for sx in (-1, 1):
        m.cushion((xi - 0.005, 0.22, 0.70), (sx * xi / 2, 0.33, 0.12), fab, puff=0.4, round_=0.45, cuts=5, pinch=0.05,
                  name="seat")
        m.cushion((xi - 0.02, 0.44, 0.26), (sx * xi / 2, 0.47, -0.20), fab, puff=0.45, round_=0.48, cuts=5,
                  pinch=0.08, rot=(-12, 0, 0), name="back")
    return m


# ---------- 椅子 ----------

@asset("chair_wishbone.glb", (0.55, 0.75, 0.52))
def chair_wishbone(tint=None):
    """Yチェア風。U字に曲げた笠木兼肘、Y字の背板、ペーパーコード編みの座。"""
    m = Model("chair_wishbone")
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    cord = m.mat("tint", tint or "#e3cf9e", rough=0.95)
    sy = 0.43
    # 笠木: 平面でU字、後ろが高い
    R, zc = 0.255, -0.04
    rail = []
    for i in range(25):
        t = math.pi * i / 24
        rail.append((R * math.cos(t), 0.665 + 0.07 * math.sin(t), zc - 0.20 * math.sin(t)))
    rail = [(R, 0.66, 0.07)] + rail + [(-R, 0.66, 0.07)]
    _tube(m, rail, 0.016, wood, seg=10, name="top_rail")
    for sx in (-1, 1):
        # 前脚 (まっすぐ)、後ろ脚 (座から上で前へ曲がり笠木を支える)
        m.rod((sx * 0.22, 0.0, 0.225), (sx * 0.215, sy, 0.205), 0.017, wood, seg=10, r2=0.02, name="front_leg")
        _tube(m, [(sx * 0.215, 0.0, -0.235), (sx * 0.217, 0.2, -0.22), (sx * 0.22, sy, -0.2),
                  (sx * 0.226, 0.53, -0.175), (sx * 0.232, 0.62, -0.145), (sx * 0.236, 0.692, -0.118)],
              0.019, wood, seg=10, name="rear_leg")
        m.rod((sx * 0.218, 0.16, 0.215), (sx * 0.217, 0.16, -0.22), 0.01, wood, seg=8, name="side_stretcher")
    m.rod((-0.22, 0.12, 0.215), (0.22, 0.12, 0.215), 0.01, wood, seg=8, name="front_stretcher")
    m.rod((-0.217, 0.2, -0.22), (0.217, 0.2, -0.22), 0.01, wood, seg=8, name="back_stretcher")
    # 座枠
    for z in (0.205, -0.2):
        m.box((0.44, 0.04, 0.03), (0, sy - 0.02, z), wood, bevel=0.006, name="seat_rail")
    for sx in (-1, 1):
        m.box((0.03, 0.04, 0.40), (sx * 0.215, sy - 0.02, 0.0), wood, bevel=0.006, name="seat_rail")
    # 編み座: 下地と、前後・左右に張ったコード
    m.box((0.41, 0.016, 0.38), (0, sy - 0.004, 0.003), cord, bevel=0.004, name="seat_base")
    n = 15
    for i in range(n):
        x = -0.19 + 0.38 * i / (n - 1)
        m.rod((x, sy + 0.006, -0.185), (x, sy + 0.006, 0.19), 0.0075, cord, seg=6, name="cord")
    for i in range(n):
        z = -0.175 + 0.36 * i / (n - 1)
        m.rod((-0.2, sy + 0.009, z), (0.2, sy + 0.009, z), 0.0065, cord, seg=6, name="cord")
    # Y字の背板 (少し後ろへ傾ける)
    yb = [(-0.035, 0.0), (0.035, 0.0), (0.035, 0.125), (0.10, 0.285), (0.072, 0.30), (0.0, 0.165),
          (-0.072, 0.30), (-0.10, 0.285), (-0.035, 0.125)]
    m.prism(yb, 0.018, wood, plane="xy", offset=-0.009, bevel=0.005, rot=(-6, 0, 0), center=(0, sy - 0.02, -0.2),
            fan=True, name="splat")
    return m


@asset("chair_windsor.glb", (0.50, 0.90, 0.50))
def chair_windsor(tint=None):
    """ウィンザーチェア。くぼんだ座板、外へ開いた脚、弓形の笠木と細い背棒。"""
    m = Model("chair_windsor")
    seat = m.mat("tint", tint or P.WOOD_LIGHT, rough=0.6)
    wood = m.mat("wood", P.WOOD_MED, rough=0.55)
    sy, t = 0.45, 0.045
    ob = m.prism(rrect(0.48, 0.45, 0.16, seg=6), t, seat, plane="xz", offset=sy - t, bevel=0.012, seg=3,
                 fan=True, name="seat")
    m.deform(ob, lambda co: co if co.y < sy - 0.005 or abs(co.x) > 0.01 or abs(co.z) > 0.01
             else Vector((co.x, co.y - 0.014, co.z)))
    feet = {}
    for sx in (-1, 1):
        for sz in (-1, 1):
            top = (sx * 0.15, sy - t, sz * 0.13)
            bot = (sx * 0.215, 0.0, sz * 0.205)
            m.rod(bot, top, 0.016, wood, seg=10, r2=0.02, name="leg")
            feet[sx, sz] = tuple(b + (c - b) * 0.38 for b, c in zip(bot, top))
    # H型の貫
    for sx in (-1, 1):
        m.rod(feet[sx, -1], feet[sx, 1], 0.011, wood, seg=8, name="side_stretcher")
    a = tuple((p + q) / 2 for p, q in zip(feet[-1, -1], feet[-1, 1]))
    b = tuple((p + q) / 2 for p, q in zip(feet[1, -1], feet[1, 1]))
    m.rod(a, b, 0.011, wood, seg=8, name="mid_stretcher")
    # 弓形の笠木 (後ろへ傾ける)
    zb, hb, xb = -0.17, 0.43, 0.185

    path = []
    for i in range(29):
        th = math.pi * i / 28
        x = xb * math.cos(th) * (1 + 0.12 * math.sin(th))  # 上ほど少し膨らむ風船形
        y = sy - 0.005 + hb * math.sin(th)
        path.append((x, y, zb - 0.085 * (y - sy) / hb))
    _tube(m, path, 0.013, wood, seg=10, name="bow")
    for x in (-0.12, -0.06, 0.0, 0.06, 0.12):
        # 弓の内側までの高さを、弓の折れ線から探す
        best = min(path[1:-1], key=lambda p: abs(p[0] - x) if p[1] > sy + 0.1 else 9)
        m.rod((x, sy - 0.01, zb + 0.005), (x, best[1], best[2]), 0.0085, wood, seg=8, r2=0.0075, name="spindle")
    return m


@asset("chair_rattan.glb", (0.60, 0.80, 0.60))
def chair_rattan(tint=None):
    """丸いラタンのラウンジチェア。籐の巻き筋が見える胴と、肘まで包む背、丸い座クッション。"""
    m = Model("chair_rattan")
    rattan = m.mat("rattan", "#d9b88a", rough=0.9)
    fab = m.mat("tint", tint or "#f0e4d0", rough=0.95)
    R = 0.28
    # 胴 (籐を巻いた筋)
    prof = [(0.0, 0.0), (0.22, 0.0)]
    y = 0.012
    band = 0.034
    while y + band < 0.40:
        prof += [(0.235 + 0.04 * y / 0.40, y), (0.243 + 0.04 * y / 0.40, y + band / 2)]
        y += band
    prof += [(0.275, 0.40), (0.0, 0.40)]
    m.lathe(prof, (0, 0, 0), rattan, seg=36, name="drum")
    # 背: 後ろが高く、前の肘へ下がる殻
    span = math.radians(125)

    def top(th):
        return 0.79 - 0.22 * (abs(th) / span) ** 1.6

    def fn(u, v):
        th = (u * 2 - 1) * span
        yy = 0.36 + v * (top(th) - 0.36)
        rs = R - 0.006
        return (rs * math.sin(th), yy, -rs * math.cos(th))

    m.surface(28, 6, fn, rattan, thickness=0.02, name="back_shell")
    # 横に巻いた籐の筋 (殻の内外へ少し出る)
    y = 0.42
    while y < 0.77:
        lim = span if y < 0.565 else span * ((0.79 - y) / 0.22) ** (1 / 1.6) - 0.06
        k = max(2, int(24 * lim / span))
        _tube(m, [(R * math.sin(th), y, -R * math.cos(th)) for th in (lim * (2 * i / k - 1) for i in range(k + 1))],
              0.019, rattan, seg=6, name="band")
        y += 0.036
    rim = [((R + 0.002) * math.sin(th), top(th) + 0.004, -(R + 0.002) * math.cos(th))
           for th in ((i / 30 * 2 - 1) * span for i in range(31))]
    _tube(m, rim, 0.02, rattan, seg=10, name="rim")
    # 座と背のクッション
    m.lathe([(0.0, 0.385), (0.235, 0.385), (0.255, 0.405), (0.258, 0.43), (0.245, 0.455), (0.19, 0.47),
             (0.0, 0.475)], (0, 0, 0.0), fab, seg=36, name="seat")
    m.cushion((0.34, 0.26, 0.08), (0, 0.60, -0.185), fab, puff=0.35, round_=0.45, cuts=4, rot=(-10, 0, 0),
                   name="back")
    return m


@asset("pouf_square.glb", (0.40, 0.40, 0.40))
def pouf_square(tint=None):
    """ニットのキューブ型スツール。横に走る編み目のうねりと、ふくらんだ天面。"""
    m = Model("pouf_square")
    knit = m.mat("tint", tint or "#d9c2d8", rough=0.95)
    S, r0 = 0.40, 0.07
    rings = []
    n = 48
    for i in range(n + 1):
        y = S * i / n
        # 上下の角を丸める
        e = 0.035
        if y < e:
            inset = e - math.sqrt(max(0.0, e * e - (e - y) ** 2))
        elif y > S - e:
            inset = e - math.sqrt(max(0.0, e * e - (y - (S - e)) ** 2))
        else:
            inset = 0.0
        rib = 0.004 * (1 - abs(math.sin(math.pi * (y - e) / ((S - 2 * e) / 9)))) if e < y < S - e else 0.0
        k = inset + 0.004 - rib
        rings.append((rrect(S - 2 * k, S - 2 * k, max(r0 - k, 0.01), seg=5), y))
    _loft(m, rings, knit, cap_lift=(0.0, 0.008), name="body")
    return m


@asset("bench_upholstered.glb", (1.20, 0.45, 0.40))
def bench_upholstered(tint=None):
    """ベッド足元用の布張りベンチ。厚い座と木の脚。"""
    m = Model("bench_upholstered")
    fab = m.mat("tint", tint or "#c8b4d6", rough=0.95)
    wood = m.mat("wood", P.WOOD_MED, rough=0.55)
    btn = m.mat("button", "#a593b6", rough=0.9)
    W, D, H = 1.20, 0.40, 0.45
    leg_h = 0.27
    tapered_legs(m, [(sx * (W / 2 - 0.07), sz * (D / 2 - 0.06)) for sx in (-1, 1) for sz in (-1, 1)], leg_h, wood,
                 top=0.05, bottom=0.034)
    m.box((W - 0.06, 0.05, D - 0.06), (0, leg_h + 0.025, 0), wood, bevel=0.008, name="frame")
    m.rod((-(W / 2 - 0.07), 0.08, 0), (W / 2 - 0.07, 0.08, 0), 0.012, wood, seg=8, name="stretcher")
    for sx in (-1, 1):
        m.rod((sx * (W / 2 - 0.07), 0.08, -(D / 2 - 0.06)), (sx * (W / 2 - 0.07), 0.08, D / 2 - 0.06), 0.011, wood,
              seg=8, name="stretcher")
    th = H - leg_h - 0.04
    m.cushion((W, th, D), (0, leg_h + 0.04 + th / 2 - 0.002, 0), fab, puff=0.15, round_=0.3, cuts=6, name="seat")
    for x in (-0.36, 0.0, 0.36):
        m.sphere(0.012, (x, H - 0.006, 0), btn, seg=8, rings=5, scale=(1, 0.6, 1), name="button")
    return m


# ---------- テーブル ----------

def _ellipse(a, b, seg=48):
    return [(a * math.cos(math.tau * i / seg), b * math.sin(math.tau * i / seg)) for i in range(seg)]


@asset("table_low_oval.glb", (1.00, 0.35, 0.55))
def table_low_oval(tint=None):
    m = Model("table_low_oval")
    top = m.mat("tint", tint or P.WOOD_LIGHT, rough=0.6)
    wood = m.mat("wood", P.WOOD_MED, rough=0.55)
    W, D, H, t = 1.00, 0.55, 0.35, 0.03
    m.prism(_ellipse(W / 2, D / 2, 56), t, top, plane="xz", offset=H - t, bevel=0.01, seg=3, name="top")
    m.prism(_ellipse(W / 2 - 0.08, D / 2 - 0.07, 48), 0.04, wood, plane="xz", offset=H - t - 0.04, bevel=0.006,
            name="skirt")
    for sx in (-1, 1):
        for sz in (-1, 1):
            a, b = (sx * 0.30, H - t - 0.02, sz * 0.12), (sx * 0.355, 0.0, sz * 0.17)
            m.rod(b, a, 0.017, wood, seg=12, r2=0.024, name="leg")
    return m


def _side_table(m, W, H, D, cz, top, leg, t=0.022, r=0.012):
    """細い角脚のサイドテーブル。前後 (Z) の中心 cz。"""
    m.prism(rrect(W, D, 0.03), t, top, plane="xz", offset=H - t, bevel=0.006, center=(0, 0, cz), name="top")
    e = r + 0.006
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box((2 * r, H - t, 2 * r), (sx * (W / 2 - e), (H - t) / 2, cz + sz * (D / 2 - e)), leg, bevel=0.003,
                  name="leg")
    for sx in (-1, 1):
        m.box((0.016, 0.025, D - 2 * e), (sx * (W / 2 - e), H - t - 0.0125, cz), leg, bevel=0.003, name="rail")
    m.box((W - 2 * e, 0.025, 0.016), (0, H - t - 0.0125, cz - (D / 2 - e)), leg, bevel=0.003, name="rail")


@asset("table_nesting.glb", (0.50, 0.50, 0.40))
def table_nesting(tint=None):
    """2台組のネストテーブル。小さい方を大きい方の下から少し前へ引き出した状態。"""
    m = Model("table_nesting")
    top = m.mat("tint", tint or P.WOOD_LIGHT, rough=0.6)
    leg = m.mat("metal", P.METAL_DARK, rough=0.6)
    # 大: 前の脚の間から小が出る。前の幕板は付けない
    _side_table(m, 0.50, 0.50, 0.34, -0.03, top, leg)
    _side_table(m, 0.40, 0.42, 0.30, 0.05, top, leg, r=0.011)
    return m


@asset("table_dining_6.glb", (1.80, 0.72, 0.90))
def table_dining_6(tint=None):
    m = Model("table_dining_6")
    top = m.mat("tint", tint or P.WOOD_LIGHT, rough=0.6)
    wood = m.mat("wood", P.WOOD_MED, rough=0.55)
    W, D, H, t = 1.80, 0.90, 0.72, 0.045
    top_rect(m, W, D, H, t, top, r=0.025)
    e = 0.09
    tapered_legs(m, [(sx * (W / 2 - e), sz * (D / 2 - e)) for sx in (-1, 1) for sz in (-1, 1)], H - t, wood,
                 top=0.07, bottom=0.05)
    apron(m, W, D, H - t, 0.09, e, wood)
    m.box((0.02, 0.07, D - 2 * e), (0, H - t - 0.035, 0), wood, bevel=0.003, name="center_rail")
    return m


@asset("table_folding_low.glb", (0.75, 0.33, 0.50))
def table_folding_low(tint=None):
    """脚を折り畳めるローテーブル (広げた状態)。左右にコの字の脚と金具。"""
    m = Model("table_folding_low")
    top = m.mat("tint", tint or P.WOOD_LIGHT, rough=0.6)
    wood = m.mat("wood", P.WOOD_MED, rough=0.55)
    metal = m.mat("metal", "#8a86a0", rough=0.7)
    W, D, H, t = 0.75, 0.50, 0.33, 0.028
    top_rect(m, W, D, H, t, top, r=0.035)
    yb = H - t
    for sx in (-1, 1):
        x = sx * (W / 2 - 0.09)
        # 脚枠: 2本の脚 + 床の横木 + 天板下の横木
        for sz in (-1, 1):
            m.box((0.032, yb - 0.045, 0.032), (x, (yb - 0.045) / 2 + 0.02, sz * 0.19), wood, bevel=0.004,
                  name="leg")
        m.box((0.04, 0.025, 0.44), (x, 0.0125, 0), wood, bevel=0.005, name="foot_bar")
        m.box((0.036, 0.03, 0.44), (x, yb - 0.04, 0), wood, bevel=0.004, name="top_bar")
        # 天板裏の受け木と蝶番金具
        m.box((0.05, 0.022, 0.44), (x - sx * 0.005, yb - 0.011, 0), wood, bevel=0.004, name="cleat")
        for sz in (-1, 1):
            m.box((0.012, 0.035, 0.05), (x + sx * 0.024, yb - 0.025, sz * 0.12), metal, bevel=0.003, name="hinge")
            m.cyl(0.008, 0.016, (x + sx * 0.03, yb - 0.032, sz * 0.12), metal, seg=8, axis="x", name="hinge_pin")
    return m


@asset("table_glass_low.glb", (1.00, 0.40, 0.55))
def table_glass_low(tint=None):
    """ガラス天板のローテーブル。木の枠と下段の棚板。"""
    m = Model("table_glass_low")
    wood = m.mat("tint", tint or P.WOOD_MED, rough=0.6)
    glass = m.mat("glass", P.GLASS, rough=0.15, alpha=0.38)
    W, D, H = 1.00, 0.55, 0.40
    tg = 0.012
    m.box((W, tg, D), (0, H - tg / 2, 0), glass, bevel=0.004, name="glass_top")
    s, e = 0.04, 0.05
    yf = H - tg
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box((s, yf, s), (sx * (W / 2 - e), yf / 2, sz * (D / 2 - e)), wood, bevel=0.005, name="leg")
    # 天板を受ける枠
    for sz in (-1, 1):
        m.box((W - 2 * e, 0.045, 0.025), (0, yf - 0.0225, sz * (D / 2 - e)), wood, bevel=0.004, name="frame")
    for sx in (-1, 1):
        m.box((0.025, 0.045, D - 2 * e), (sx * (W / 2 - e), yf - 0.0225, 0), wood, bevel=0.004, name="frame")
    # 下段の棚板
    m.box((W - 2 * e + s - 0.01, 0.022, D - 2 * e + s - 0.01), (0, 0.10, 0), wood, bevel=0.005, name="shelf")
    return m


def _set_chair(m, cz, facing, wood, pad):
    """2人用セットの椅子。facing=+1 で +Z を向く (テーブルの奥側に置く)。"""
    def p(x, y, z):
        return (x, y, cz + facing * z)

    sy = 0.44
    for sx in (-1, 1):
        m.rod(p(sx * 0.18, 0.0, 0.19), p(sx * 0.18, sy - 0.03, 0.18), 0.015, wood, seg=10, r2=0.018,
              name="front_leg")
        m.rod(p(sx * 0.18, 0.0, -0.21), p(sx * 0.18, sy - 0.03, -0.19), 0.015, wood, seg=10, r2=0.018,
              name="rear_leg")
        m.rod(p(sx * 0.18, sy - 0.03, -0.19), p(sx * 0.185, 0.745, -0.24), 0.016, wood, seg=10, r2=0.015,
              name="back_post")
        m.rod(p(sx * 0.18, 0.14, 0.185), p(sx * 0.18, 0.14, -0.2), 0.009, wood, seg=8, name="stretcher")
    m.box((0.42, 0.035, 0.42), p(0, sy - 0.0175, 0), wood, bevel=0.007, name="seat")
    m.cushion((0.38, 0.04, 0.37), p(0, sy + 0.012, 0.01), pad, puff=0.35, round_=0.4, cuts=4, name="seat_pad")
    # 背もたれの板 (2枚)。後ろの柱と同じ傾き
    tilt = math.degrees(math.atan2(0.05, 0.315))
    for y, h in ((0.69, 0.08), (0.56, 0.035)):
        z = -0.19 - 0.05 * (y - (sy - 0.03)) / 0.315
        m.box((0.36, h, 0.02), p(0, y, z), wood, bevel=0.006, rot=(-tilt * facing, 0, 0), name="back_rail")


@asset("dining_set_2.glb", (1.00, 0.75, 1.00))
def dining_set_2(tint=None):
    """2人用のダイニングセット。テーブルの前後 (Z) に椅子を1脚ずつ、少し引いて置く。"""
    m = Model("dining_set_2")
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    pad = m.mat("tint", tint or "#e8c4b4", rough=0.95)
    W, D, H, t = 1.00, 0.62, 0.72, 0.035
    top_rect(m, W, D, H, t, wood, r=0.02)
    e = 0.05
    round_legs(m, [(sx * (W / 2 - e), sz * (D / 2 - e)) for sx in (-1, 1) for sz in (-1, 1)], H - t, wood, r=0.026)
    apron(m, W, D, H - t, 0.07, e, wood)
    # 椅子の背の外側が奥行き 1.00 の端になる
    _set_chair(m, -0.25, 1, wood, pad)
    _set_chair(m, 0.25, -1, wood, pad)
    return m
