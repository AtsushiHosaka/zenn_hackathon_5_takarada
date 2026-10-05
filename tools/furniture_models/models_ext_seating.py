"""追加の椅子・ソファ・小さなテーブル (2026-10-04)。"""
import math

import bmesh

import palette as P
from lib import Model, asset, rrect
from models_tables import frame_leg, round_legs, tapered_legs, top_rect


def _lean(base_z, base_y, a, s, n):
    """後ろへ a 度傾けた板の座標。基準点から上方向へ s、正面方向へ n 進んだ点 (z, y)。"""
    r = math.radians(a)
    return base_z - math.sin(r) * s + math.cos(r) * n, base_y + math.cos(r) * s + math.sin(r) * n


def _sweep_zy(m, path, w, h, x, mat, bevel=0.006, name="sweep"):
    """側面 (z, y) の折れ線に沿って、幅 w (X方向)・厚み h の角材を通す。曲がった脚や揺り木に使う。"""
    bm = bmesh.new()
    rings = []
    n = len(path)
    for i, (z, y) in enumerate(path):
        a, b = path[max(i - 1, 0)], path[min(i + 1, n - 1)]
        tz, ty = b[0] - a[0], b[1] - a[1]
        L = math.hypot(tz, ty)
        nz, ny = -ty / L, tz / L
        rings.append([bm.verts.new((x + dx, y + ny * dn, z + nz * dn))
                      for dx, dn in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2))])
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(4):
            bm.faces.new((r0[k], r0[(k + 1) % 4], r1[(k + 1) % 4], r1[k]))
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = m._obj(bm, mat, name)
    return m.bevel(ob, min(bevel, 0.45 * min(w, h)), 2)


@asset("armchair_wing.glb", (0.80, 1.00, 0.85))
def armchair_wing(tint=None):
    m = Model("armchair_wing")
    fab = m.mat("tint", tint or "#a9bfae", rough=0.95)
    wood = m.mat("wood", P.WOOD_MED, rough=0.55)
    leg_h = 0.12
    tapered_legs(m, [(sx * 0.33, sz * 0.34) for sx in (-1, 1) for sz in (-1, 1)], leg_h, wood, top=0.05, bottom=0.034)
    m.box((0.78, 0.20, 0.80), (0, leg_h + 0.10, 0.0), fab, bevel=0.03, seg=3, name="base")
    # 背の高い背もたれ。上端は丸く
    m.box((0.62, 0.80, 0.16), (0, leg_h + 0.40, -0.345), fab, bevel=0.04, seg=3, name="back_frame")
    m.cyl(0.08, 0.62, (0, 0.92, -0.345), fab, seg=20, axis="x", bevel=0.03, bseg=3, name="back_crown")
    # 袖 (前で巻いたロールアーム)
    for sx in (-1, 1):
        m.cushion((0.12, 0.38, 0.80), (sx * 0.335, 0.43, 0.02), fab, puff=0.05, round_=0.35, cuts=3, name="arm")
        m.cyl(0.065, 0.80, (sx * 0.335, 0.60, 0.02), fab, seg=18, axis="z", bevel=0.03, bseg=3, name="arm_roll")
    # 耳 (ウイング)。頭の横を包む板
    wing = [(-0.42, 0.60), (0.05, 0.60), (0.075, 0.70), (0.04, 0.81), (-0.06, 0.90), (-0.22, 0.955), (-0.42, 0.97)]
    for x0 in (-0.40, 0.31):
        m.prism(wing, 0.09, fab, plane="zy", offset=x0, bevel=0.035, seg=3, name="wing")
    m.cushion((0.56, 0.14, 0.66), (0, 0.38, 0.07), fab, puff=0.25, round_=0.35, cuts=4, name="seat")
    m.cushion((0.54, 0.50, 0.14), (0, 0.70, -0.22), fab, puff=0.25, round_=0.35, cuts=4, rot=(-8, 0, 0), name="back")
    return m


@asset("chaise_longue.glb", (0.65, 0.80, 1.55))
def chaise_longue(tint=None):
    m = Model("chaise_longue")
    fab = m.mat("tint", tint or "#e2c4b8", rough=0.95)
    wood = m.mat("wood", P.WOOD_MED, rough=0.55)
    W, D, leg_h = 0.65, 1.55, 0.10
    tapered_legs(m, [(sx * 0.27, z) for sx in (-1, 1) for z in (-0.70, 0.0, 0.70)], leg_h, wood,
                 top=0.045, bottom=0.032)
    m.box((W, 0.18, D - 0.02), (0, leg_h + 0.09, 0), fab, bevel=0.03, seg=3, name="base")
    m.cushion((W - 0.04, 0.14, 1.10), (0, 0.33, 0.21), fab, puff=0.22, round_=0.32, cuts=4, name="seat")
    # -Z 側を起こした背もたれ (後ろへ28度)
    a, bz, by = 28, -0.53, 0.20
    L, t = 0.52, 0.10
    cz, cy = _lean(bz, by, a, L / 2, t / 2)
    m.box((W - 0.02, L, t), (0, cy, cz), fab, bevel=0.03, seg=3, rot=(-a, 0, 0), name="back_frame")
    Lc, tc = 0.48, 0.14
    cz, cy = _lean(bz, by, a, 0.06 + Lc / 2, t + tc / 2 - 0.02)
    m.cushion((W - 0.14, Lc, tc), (0.04, cy, cz), fab, puff=0.25, round_=0.32, cuts=4, rot=(-a, 0, 0), name="back")
    # 片側 (-X) だけの低い袖
    m.cushion((0.10, 0.34, 0.62), (-W / 2 + 0.05, 0.43, -D / 2 + 0.31), fab, puff=0.05, round_=0.4, cuts=3,
              name="arm")
    # 足元のボルスター
    m.cyl(0.065, W - 0.16, (0.04, 0.46, -0.30), fab, seg=18, axis="x", bevel=0.03, bseg=3, name="bolster")
    return m


@asset("rocking_chair.glb", (0.65, 0.95, 0.90))
def rocking_chair(tint=None):
    m = Model("rocking_chair")
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    fab = m.mat("tint", tint or "#c9b6e4", rough=0.95)
    R, rh, xl = 1.4, 0.045, 0.28

    def arc(z):
        return R - math.sqrt(R * R - z * z)

    path = [(z, arc(z) + rh / 2) for z in (-0.45 + 0.9 * i / 18 for i in range(19))]
    for sx in (-1, 1):
        x = sx * xl
        _sweep_zy(m, path, 0.035, rh, x, wood, bevel=0.008, name="rocker")
        # 前脚は肘掛けまで、後ろ脚はそのまま背もたれの支柱へ
        m.rod((x, arc(0.20) + 0.02, 0.20), (x, 0.635, 0.20), 0.018, wood, seg=10, name="front_post")
        m.rod((x, arc(-0.22) + 0.02, -0.22), (x, 0.42, -0.22), 0.019, wood, seg=10, name="rear_leg")
        m.rod((x, 0.42, -0.22), (x, 0.93, -0.36), 0.018, wood, seg=10, name="back_post")
        m.box((0.07, 0.03, 0.56), (sx * 0.29, 0.635, -0.01), wood, bevel=0.008, name="arm")
        m.rod((x, 0.16, 0.20), (x, 0.16, -0.22), 0.012, wood, seg=8, name="side_stretcher")
    m.rod((-xl, 0.16, 0.20), (xl, 0.16, 0.20), 0.012, wood, seg=8, name="front_stretcher")
    m.rod((-xl, 0.91, -0.355), (xl, 0.91, -0.355), 0.022, wood, seg=12, name="top_rail")
    m.rod((-xl, 0.50, -0.245), (xl, 0.50, -0.245), 0.015, wood, seg=10, name="low_rail")
    for k in (-1, 0, 1):
        m.rod((k * 0.12, 0.50, -0.25), (k * 0.12, 0.90, -0.36), 0.009, wood, seg=8, name="spindle")
    m.box((0.58, 0.04, 0.48), (0, 0.40, -0.01), wood, bevel=0.008, name="seat_frame")
    m.cushion((0.50, 0.07, 0.44), (0, 0.45, 0.0), fab, puff=0.3, round_=0.4, cuts=4, name="seat")
    m.cushion((0.48, 0.40, 0.07), (0, 0.68, -0.25), fab, puff=0.3, round_=0.4, cuts=4, rot=(-15, 0, 0), name="back")
    return m


@asset("sofa_bed.glb", (1.40, 0.80, 0.85))
def sofa_bed(tint=None):
    """布団式ソファベッドをソファにした状態。木の枠に厚いマットレスを折って載せる。"""
    m = Model("sofa_bed")
    fab = m.mat("tint", tint or "#9fb4c8", rough=0.95)
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    tie = m.mat("tie", "#6f6a86", rough=0.9)
    W, a = 1.40, 12
    # 左右の木枠 (肘掛け)。柱2本・横木2本・縦格子
    for sx in (-1, 1):
        x = sx * 0.675
        m.box((0.05, 0.58, 0.05), (x, 0.29, 0.37), wood, bevel=0.006, name="front_post")
        m.box((0.05, 0.62, 0.05), (x, 0.31, -0.39), wood, bevel=0.006, name="rear_post")
        m.box((0.07, 0.04, 0.84), (x, 0.58, -0.005), wood, bevel=0.01, name="armrest")
        m.box((0.04, 0.05, 0.74), (x, 0.17, -0.01), wood, bevel=0.005, name="side_rail")
        for z in (-0.18, 0.0, 0.18):
            m.box((0.025, 0.37, 0.03), (x, 0.38, z), wood, bevel=0.004, name="spindle")
    m.box((1.32, 0.08, 0.04), (0, 0.19, 0.38), wood, bevel=0.006, name="front_rail")
    m.box((1.30, 0.03, 0.60), (0, 0.225, 0.09), wood, bevel=0.004, name="seat_deck")
    # マットレス: 座面と、背もたれ側へ折り上げた部分
    m.cushion((1.30, 0.17, 0.57), (0, 0.32, 0.135), fab, puff=0.2, round_=0.3, cuts=4, name="mattress_seat")
    t, L = 0.17, 0.54
    bz, by = -0.13 - math.cos(math.radians(a)) * t, 0.25
    m.box((1.32, 0.56, 0.03), (0, *reversed(_lean(bz - 0.025, by - 0.02, a, 0.28, 0.0))), wood, bevel=0.004,
          rot=(-a, 0, 0), name="back_deck")
    cz, cy = _lean(bz, by, a, L / 2, t / 2)
    m.cushion((1.30, L, t), (0, cy, cz), fab, puff=0.2, round_=0.3, cuts=4, rot=(-a, 0, 0), name="mattress_back")
    m.cyl(0.085, 1.28, (0, 0.32, -0.15), fab, seg=18, axis="x", name="fold")
    # 布団のとじ糸
    for x in (-0.42, 0.0, 0.42):
        for z in (0.0, 0.26):
            m.cyl(0.017, 0.012, (x, 0.405, z), tie, seg=10, bevel=0.004, name="tie")
        for s in (0.22, 0.42):
            cz, cy = _lean(bz, by, a, s, t)
            m.cyl(0.017, 0.012, (x, cy, cz), tie, seg=10, bevel=0.004, rot=(90 - a, 0, 0), name="tie")
    return m


@asset("sofa_modular.glb", (2.10, 0.80, 2.10))
def sofa_modular(tint=None):
    """L字のモジュールソファ。角モジュール + 両腕に1台ずつ。背もたれは -Z と -X 側。"""
    m = Model("sofa_modular")
    fab = m.mat("tint", tint or P.GREIGE, rough=0.95)
    plinth = m.mat("plinth", "#7d7690", rough=0.8)
    S, gap = 2.10, 0.008
    h = S / 2
    leg_h, base_top, seat_t = 0.05, 0.26, 0.16
    frame_top, bt, bc, arm_w, arm_top = 0.60, 0.16, 0.19, 0.14, 0.58
    bh = 0.80 - (base_top + seat_t - 0.03) - 0.01
    mid = -h + 1.0
    modules = [(-h, mid, -h, mid, ("-z", "-x"), None),
               (mid, h, -h, mid, ("-z",), "+x"),
               (-h, mid, mid, h, ("-x",), "+z")]
    for x0, x1, z0, z1, backs, arm in modules:
        cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
        w, d = x1 - x0 - gap, z1 - z0 - gap
        m.box((w - 0.08, leg_h, d - 0.08), (cx, leg_h / 2, cz), plinth, bevel=0.005, name="plinth")
        m.box((w, base_top - leg_h, d), (cx, (base_top + leg_h) / 2, cz), fab, bevel=0.02, name="base")
        xa = x0 + (bt if "-x" in backs else 0) + gap / 2
        za = z0 + (bt if "-z" in backs else 0) + gap / 2
        xb = x1 - (arm_w if arm == "+x" else 0) - gap / 2
        zb = z1 - (arm_w if arm == "+z" else 0) - gap / 2
        m.cushion((xb - xa - 0.01, seat_t + 0.025, zb - za - 0.01),
                  ((xa + xb) / 2, base_top + (seat_t + 0.025) / 2 - 0.01, (za + zb) / 2), fab,
                  puff=0.22, round_=0.32, cuts=3, name="seat")
        if "-z" in backs:
            m.box((w, frame_top - leg_h, bt), (cx, (frame_top + leg_h) / 2, z0 + gap / 2 + bt / 2), fab,
                  bevel=0.03, seg=3, name="back_frame")
            m.cushion((xb - xa - 0.012, bh, bc), ((xa + xb) / 2, base_top + seat_t - 0.03 + bh / 2, za + bc / 2 - 0.02),
                      fab, puff=0.25, round_=0.3, cuts=3, rot=(-9, 0, 0), name="back")
        if "-x" in backs:
            m.box((bt, frame_top - leg_h, d), (x0 + gap / 2 + bt / 2, (frame_top + leg_h) / 2, cz), fab,
                  bevel=0.03, seg=3, name="back_frame")
            zs = za + (bc if "-z" in backs else 0)
            m.cushion((bc, bh, zb - zs - 0.012), (xa + bc / 2 - 0.02, base_top + seat_t - 0.03 + bh / 2, (zs + zb) / 2),
                      fab, puff=0.25, round_=0.3, cuts=3, rot=(0, 0, 9), name="back")
        if arm == "+x":
            m.cushion((arm_w, arm_top - leg_h, d), (x1 - gap / 2 - arm_w / 2, (arm_top + leg_h) / 2, cz), fab,
                      puff=0.06, round_=0.38, cuts=3, name="arm")
        if arm == "+z":
            m.cushion((w, arm_top - leg_h, arm_w), (cx, (arm_top + leg_h) / 2, z1 - gap / 2 - arm_w / 2), fab,
                      puff=0.06, round_=0.38, cuts=3, name="arm")
    return m


@asset("chair_folding.glb", (0.45, 0.80, 0.48))
def chair_folding(tint=None):
    m = Model("chair_folding")
    frame = m.mat("metal", "#9a95ad", rough=0.6)
    wood = m.mat("tint", tint or P.WOOD_LIGHT, rough=0.55)
    cap = m.mat("plastic", "#5b566b", rough=0.8)
    r, xo, xi = 0.012, 0.205, 0.17
    for sx in (-1, 1):
        # 背もたれから後ろ脚へ続く外側のパイプ
        m.rod((sx * xo, 0.0, -0.17), (sx * xo, 0.785, -0.215), r, frame, seg=10, name="back_tube")
        # 前脚: 床の前から座面の後ろへ斜めに
        m.rod((sx * xi, 0.0, 0.25), (sx * xi, 0.43, -0.17), r, frame, seg=10, name="front_leg")
        m.rod((sx * (xo - 0.012), 0.425, -0.19), (sx * (xo - 0.012), 0.425, 0.21), 0.01, frame, seg=8,
              name="seat_rail")
        for x, z in ((sx * xo, -0.17), (sx * xi, 0.25)):
            m.cyl(0.016, 0.02, (x, 0.01, z), cap, seg=10, name="foot_cap")
    m.rod((-xo, 0.785, -0.215), (xo, 0.785, -0.215), r, frame, seg=10, name="top_tube")
    m.rod((-xo, 0.08, -0.174), (xo, 0.08, -0.174), 0.009, frame, seg=8, name="rear_stretcher")
    m.rod((-xi, 0.07, 0.234), (xi, 0.07, 0.234), 0.009, frame, seg=8, name="front_stretcher")
    m.rod((-xo + 0.01, 0.425, 0.21), (xo - 0.01, 0.425, 0.21), 0.01, frame, seg=8, name="seat_front")
    m.box((0.40, 0.022, 0.40), (0, 0.446, 0.015), wood, bevel=0.008, name="seat")
    m.box((0.43, 0.13, 0.018), (0, 0.69, -0.193), wood, bevel=0.006, rot=(-3, 0, 0), name="backrest")
    return m


@asset("chair_shell.glb", (0.47, 0.80, 0.52))
def chair_shell(tint=None):
    m = Model("chair_shell")
    shell = m.mat("tint", tint or "#e8c2b0", rough=0.85)
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    wire = m.mat("metal", P.METAL_DARK, rough=0.6)
    # 座面から背もたれへ続く一枚の殻 (側面の中心線)
    ctrl = [(0.225, 0.428), (0.21, 0.448), (0.16, 0.457), (0.08, 0.452), (-0.02, 0.443), (-0.10, 0.445),
            (-0.155, 0.465), (-0.195, 0.505), (-0.22, 0.565), (-0.235, 0.645), (-0.245, 0.725), (-0.25, 0.79)]
    acc = [0.0]
    for p, q in zip(ctrl, ctrl[1:]):
        acc.append(acc[-1] + math.dist(p, q))

    def along(v):
        s = v * acc[-1]
        for i in range(len(ctrl) - 1):
            if s <= acc[i + 1] or i == len(ctrl) - 2:
                k = (s - acc[i]) / max(acc[i + 1] - acc[i], 1e-9)
                (z0, y0), (z1, y1) = ctrl[i], ctrl[i + 1]
                tz, ty = z1 - z0, y1 - y0
                L = math.hypot(tz, ty)
                return z0 + (z1 - z0) * k, y0 + (y1 - y0) * k, tz / L, ty / L

    def fn(u, v):
        z, y, tz, ty = along(v)
        hw = 0.205 + 0.03 * max(0.0, (v - 0.45) / 0.55)
        x = (u * 2 - 1) * hw
        lift = 0.055 * (u * 2 - 1) ** 2 * min(1.0, 0.35 + 3 * v)  # 縁を座る側へ持ち上げて器状に (前端は控えめ)
        return (x, y - tz * lift, z + ty * lift)

    m.surface(15, 30, fn, shell, thickness=0.014, name="shell")
    m.box((0.20, 0.02, 0.20), (0, 0.42, -0.01), wire, bevel=0.005, name="mount")
    tops, mids = [], []
    for sx in (-1, 1):
        for sz in (-1, 1):
            top = (sx * 0.085, 0.415, sz * 0.085 - 0.01)
            bot = (sx * 0.205, 0.0, sz * 0.225)
            m.rod(bot, top, 0.016, wood, seg=10, r2=0.019, name="leg")
            tops.append(top)
            mids.append(tuple(b + (c - b) * 0.45 for b, c in zip(bot, top)))
    # 金属ワイヤーの補強 (前後・左右)
    for a, b in ((0, 1), (2, 3), (0, 2), (1, 3)):
        m.rod(mids[a], mids[b], 0.005, wire, seg=6, name="wire")
    return m


@asset("stool_bar.glb", (0.40, 0.75, 0.40))
def stool_bar(tint=None):
    m = Model("stool_bar")
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    pad = m.mat("tint", tint or "#e9c79c", rough=0.95)
    ring = m.mat("metal", "#8a86a0", rough=0.6)
    H = 0.75
    m.cyl(0.198, 0.045, (0, H - 0.0225, 0), pad, seg=40, bevel=0.018, bseg=3, name="seat_pad")
    m.cyl(0.19, 0.03, (0, H - 0.06, 0), wood, seg=40, bevel=0.006, name="seat_board")
    for k in range(4):
        a = math.radians(45 + 90 * k)
        m.rod((0.175 * math.cos(a), 0.0, 0.175 * math.sin(a)), (0.115 * math.cos(a), H - 0.07, 0.115 * math.sin(a)),
              0.017, wood, seg=10, r2=0.021, name="leg")
    yr = 0.26
    rr = 0.175 - 0.06 * yr / (H - 0.07)
    t = 0.011
    m.lathe([(rr + t * math.cos(TAU_I), yr + t * math.sin(TAU_I)) for TAU_I in (math.tau * i / 8 for i in range(8))],
            (0, 0, 0), ring, seg=40, closed=True, name="foot_ring")
    return m


@asset("table_bar.glb", (1.20, 0.90, 0.45))
def table_bar(tint=None):
    m = Model("table_bar")
    wood = m.mat("wood", tint or P.WOOD_LIGHT, rough=0.55)
    metal = m.mat("metal", P.METAL_DARK, rough=0.45)
    W, H, D, t = 1.20, 0.90, 0.45, 0.035
    top_rect(m, W, D, H, t, wood, r=0.015)
    for sx in (-1, 1):
        frame_leg(m, sx * (W / 2 - 0.08), D, H - t, metal)
    m.box((W - 0.16, 0.03, 0.02), (0, H - t - 0.12, -(D / 2 - 0.04)), metal, bevel=0.003, name="cross_bar")
    # 足置きバー
    m.rod((-(W / 2 - 0.08), 0.22, D / 2 - 0.04), (W / 2 - 0.08, 0.22, D / 2 - 0.04), 0.014, metal, seg=10,
          name="foot_bar")
    return m


@asset("table_cafe.glb", (0.60, 0.72, 0.60))
def table_cafe(tint=None):
    m = Model("table_cafe")
    top = m.mat("tint", tint or "#f0e2cf", rough=0.7)
    metal = m.mat("metal", P.METAL_DARK, rough=0.5)
    H, R, t = 0.72, 0.30, 0.03
    m.cyl(R, t, (0, H - t / 2, 0), top, seg=48, bevel=0.009, bseg=3, name="top")
    m.cyl(0.075, 0.025, (0, H - t - 0.0125, 0), metal, seg=24, bevel=0.005, name="collar")
    m.cyl(0.022, H - t - 0.05, (0, (H - t + 0.04) / 2 + 0.005, 0), metal, seg=16, name="pole")
    m.cyl(0.05, 0.04, (0, 0.045, 0), metal, seg=20, bevel=0.008, name="hub")
    # 十字脚
    m.box((0.52, 0.03, 0.05), (0, 0.035, 0), metal, bevel=0.008, name="cross")
    m.box((0.05, 0.03, 0.52), (0, 0.035, 0), metal, bevel=0.008, name="cross")
    for x, z in ((0.24, 0), (-0.24, 0), (0, 0.24), (0, -0.24)):
        m.cyl(0.025, 0.02, (x, 0.01, z), metal, seg=12, bevel=0.004, name="foot")
    return m


@asset("step_stool.glb", (0.43, 0.45, 0.40))
def step_stool(tint=None):
    m = Model("step_stool")
    side = m.mat("tint", tint or "#b9d3c4", rough=0.8)
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    # 側板 (階段状)。下に浅いアーチの切り欠き代わりに脚を分ける
    prof = [(-0.20, 0.0), (-0.13, 0.0), (-0.11, 0.035), (0.11, 0.035), (0.13, 0.0), (0.20, 0.0), (0.20, 0.205),
            (0.005, 0.205), (0.005, 0.425), (-0.20, 0.425)]
    for x0 in (-0.195, 0.17):
        m.prism(prof, 0.025, side, plane="zy", offset=x0, bevel=0.006, seg=2, fan=False, name="side")
    m.box((0.43, 0.025, 0.205), (0, 0.2175, 0.0975), wood, bevel=0.008, name="tread_low")
    m.box((0.43, 0.025, 0.215), (0, 0.4375, -0.0975), wood, bevel=0.008, name="tread_top")
    m.box((0.34, 0.20, 0.018), (0, 0.315, 0.0), side, bevel=0.004, name="riser")
    m.box((0.34, 0.06, 0.018), (0, 0.38, -0.19), wood, bevel=0.004, name="back_rail")
    m.box((0.34, 0.05, 0.018), (0, 0.06, -0.19), wood, bevel=0.004, name="back_rail")
    m.box((0.34, 0.05, 0.018), (0, 0.06, 0.19), wood, bevel=0.004, name="front_rail")
    return m


@asset("kids_table.glb", (0.60, 0.45, 0.60))
def kids_table(tint=None):
    m = Model("kids_table")
    top = m.mat("tint", tint or "#bfe0d6", rough=0.8)
    edge = m.mat("edge", "#f4c3b4", rough=0.85)
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    H, t = 0.45, 0.035
    m.prism(rrect(0.60, 0.60, 0.15, seg=8), t, top, plane="xz", offset=H - t, bevel=0.012, seg=3, name="top")
    m.prism(rrect(0.54, 0.54, 0.12, seg=8), 0.045, edge, plane="xz", offset=H - t - 0.045, bevel=0.008, name="skirt")
    e = 0.2
    round_legs(m, [(sx * e, sz * e) for sx in (-1, 1) for sz in (-1, 1)], H - t - 0.04, wood, r=0.036)
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.sphere(0.028, (sx * e, 0.02, sz * e), edge, seg=14, rings=8, scale=(1, 0.75, 1), name="foot")
    return m


@asset("kids_chair.glb", (0.30, 0.55, 0.30))
def kids_chair(tint=None):
    m = Model("kids_chair")
    seat = m.mat("tint", tint or "#f4c3b4", rough=0.8)
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    sy, e = 0.27, 0.112
    m.prism(rrect(0.30, 0.29, 0.06, seg=6), 0.03, seat, plane="xz", offset=sy, bevel=0.01, seg=3,
            center=(0, 0, 0.005), name="seat")
    round_legs(m, [(sx * e, e) for sx in (-1, 1)], sy, wood, r=0.02)
    for sx in (-1, 1):
        m.rod((sx * e, 0.0, -e), (sx * e, 0.49, -0.13), 0.019, wood, seg=10, name="rear_leg")
        m.rod((sx * e, 0.09, -e), (sx * e, 0.09, e), 0.009, wood, seg=8, name="stretcher")
    # 丸みのある背板
    m.prism(rrect(0.29, 0.15, 0.06, seg=6), 0.024, seat, plane="xy", offset=-0.012, bevel=0.008, seg=2,
            rot=(-6, 0, 0), center=(0, 0.465, -0.135), name="back")
    return m


@asset("high_chair.glb", (0.55, 0.90, 0.60))
def high_chair(tint=None):
    m = Model("high_chair")
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    pad = m.mat("tint", tint or "#f3c9b5", rough=0.95)
    tray = m.mat("plastic", "#f5efe6", rough=0.8)
    legs = {}
    for sx in (-1, 1):
        for sz in (-1, 1):
            top, bot = (sx * 0.15, 0.53, sz * 0.13), (sx * 0.255, 0.0, sz * 0.27)
            m.rod(bot, top, 0.019, wood, seg=10, r2=0.022, name="leg")
            legs[sx, sz] = (bot, top)

    def on_leg(sx, sz, y):
        bot, top = legs[sx, sz]
        k = y / top[1]
        return tuple(b + (c - b) * k for b, c in zip(bot, top))

    for sx in (-1, 1):
        m.rod(on_leg(sx, -1, 0.17), on_leg(sx, 1, 0.17), 0.011, wood, seg=8, name="side_stretcher")
    m.rod(on_leg(-1, -1, 0.17), on_leg(1, -1, 0.17), 0.011, wood, seg=8, name="back_stretcher")
    fx = on_leg(1, 1, 0.25)
    m.box((2 * fx[0] + 0.04, 0.022, 0.08), (0, 0.25, fx[2] - 0.02), wood, bevel=0.006, name="footrest")
    m.box((0.34, 0.035, 0.30), (0, 0.5475, 0.0), wood, bevel=0.008, name="seat")
    m.cushion((0.29, 0.04, 0.25), (0, 0.58, 0.015), pad, puff=0.3, round_=0.4, cuts=4, name="seat_pad")
    for sx in (-1, 1):
        m.rod((sx * 0.155, 0.55, -0.135), (sx * 0.165, 0.88, -0.19), 0.018, wood, seg=10, name="back_post")
        m.box((0.035, 0.03, 0.40), (sx * 0.165, 0.72, 0.0), wood, bevel=0.007, name="arm")
        m.rod((sx * 0.165, 0.565, 0.13), (sx * 0.165, 0.71, 0.13), 0.013, wood, seg=8, name="arm_post")
    m.box((0.33, 0.20, 0.025), (0, 0.775, -0.18), wood, bevel=0.008, rot=(-10, 0, 0), name="back_panel")
    m.cushion((0.27, 0.22, 0.04), (0, 0.72, -0.15), pad, puff=0.3, round_=0.4, cuts=4, rot=(-10, 0, 0),
              name="back_pad")
    # 前のトレイ (縁を少し立てる)
    m.prism(rrect(0.50, 0.22, 0.07, seg=6), 0.022, tray, plane="xz", offset=0.736, bevel=0.007, seg=2,
            center=(0, 0, 0.18), name="tray")
    m.box((0.46, 0.022, 0.02), (0, 0.765, 0.28), tray, bevel=0.008, name="tray_lip")
    return m
