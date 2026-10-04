"""ソファ・椅子・スツール。"""
import math

import palette as P
from lib import Model, asset


def _legs(m, pts, h, mat, r=0.03):
    for x, z in pts:
        m.cyl(r * 0.7, h, (x, h / 2, z), mat, seg=12, r2=r, name="leg")


def sofa(name, W, H, D0, seats, fabric, *, low=False, chaise=None, Dt=None, chaise_w=0.80, tint=None):
    """背面 z=0、座る側 +Z で組み立てる (finishで中心化)。chaise は 'left'(-X) / 'right'(+X)。"""
    Dt = Dt or D0
    m = Model(name)
    fab = m.mat("tint", tint or fabric, rough=0.95)
    wood = m.mat("wood", P.WOOD_MED, rough=0.55)
    if low:
        leg_h, base_h, seat_t, arm_top, back_t, bt = 0.03, 0.14, 0.17, 0.40, 0.15, 0.20
    else:
        leg_h, base_h, seat_t, arm_top, back_t, bt = 0.10, 0.16, 0.15, 0.60, 0.15, 0.19
    arm_w = 0.14
    base_top = leg_h + base_h
    seat_top = base_top + seat_t

    # 背もたれの土台 (全幅)
    frame_top = seat_top + 0.17
    m.box((W - 0.02, frame_top - leg_h, back_t), (0, (frame_top + leg_h) / 2, back_t / 2), fab,
          bevel=0.035, seg=3, name="back_frame")

    x0, x1 = -W / 2 + arm_w, W / 2 - arm_w
    regions = []  # (xa, xb, 奥行き, 座面数)
    if chaise == "left":
        regions = [(x0, x0 + chaise_w, Dt, 1), (x0 + chaise_w, x1, D0, seats)]
    elif chaise == "right":
        regions = [(x0, x1 - chaise_w, D0, seats), (x1 - chaise_w, x1, Dt, 1)]
    else:
        regions = [(x0, x1, D0, seats)]

    for xa, xb, depth, n in regions:
        rw = xb - xa
        m.box((rw + 0.02, base_h, depth - 0.03), ((xa + xb) / 2, leg_h + base_h / 2, (depth - 0.03) / 2), fab,
              bevel=0.02, seg=2, name="base")
        sw = rw / n
        seat_back = back_t + bt * 0.55
        seat_front = depth - 0.004
        for i in range(n):
            cx = xa + sw * (i + 0.5)
            m.cushion((sw - 0.01, seat_t + 0.025, seat_front - seat_back),
                      (cx, base_top + (seat_t + 0.025) / 2 - 0.01, (seat_back + seat_front) / 2), fab,
                      puff=0.22, round_=0.32, cuts=4, name="seat")
            bh = H - seat_top + 0.02
            m.cushion((sw - 0.012, bh, bt), (cx, seat_top - 0.03 + bh / 2 - 0.005, back_t + bt / 2 - 0.015), fab,
                      puff=0.25, round_=0.3, cuts=4, rot=(-9, 0, 0), name="back")

    left_d = Dt if chaise == "left" else D0
    right_d = Dt if chaise == "right" else D0
    for sx, ad in ((-1, left_d), (1, right_d)):
        m.cushion((arm_w, arm_top - leg_h, ad), (sx * (W / 2 - arm_w / 2), (arm_top + leg_h) / 2, ad / 2), fab,
                  puff=0.06, round_=0.38, cuts=3, name="arm")

    if low:
        dark = m.mat("plinth", P.METAL_DARK, rough=0.7)
        m.box((W - 0.12, leg_h, D0 - 0.12), (0, leg_h / 2, D0 / 2), dark, bevel=0.005, name="plinth")
        if chaise:
            pass
    else:
        e = 0.06
        pts = [(-W / 2 + e, e), (W / 2 - e, e), (-W / 2 + e, left_d - e), (W / 2 - e, right_d - e)]
        if chaise == "left":
            pts.append((x0 + chaise_w, Dt - e))
        elif chaise == "right":
            pts.append((x1 - chaise_w, Dt - e))
        if W > 1.9:
            pts.append((0, e))
        _legs(m, pts, leg_h, wood)
    return m


@asset("sofa_1seat.glb", (0.85, 0.80, 0.85))
def sofa_1seat(tint=None):
    return sofa("sofa_1seat", 0.85, 0.80, 0.85, 1, P.GREIGE, tint=tint)


@asset("sofa_2seat.glb", (1.50, 0.80, 0.85), variants={
    "w130": {"size": (1.30, 0.80, 0.85)}, "w170": {"size": (1.70, 0.80, 0.85)}})
def sofa_2seat(tint=None, size=(1.50, 0.80, 0.85)):
    return sofa("sofa_2seat", size[0], size[1], size[2], 2, P.GREIGE, tint=tint)


@asset("sofa_3seat.glb", (2.10, 0.82, 0.90))
def sofa_3seat(tint=None):
    return sofa("sofa_3seat", 2.10, 0.82, 0.90, 3, P.GREIGE, tint=tint)


@asset("sofa_low.glb", (1.60, 0.55, 0.85))
def sofa_low(tint=None):
    return sofa("sofa_low", 1.60, 0.55, 0.85, 2, P.BEIGE, low=True, tint=tint)


L_SIZES = {"s": {"size": (2.10, 0.82, 1.40)}, "l": {"size": (2.80, 0.82, 1.80)}}


def l_sofa(name, side, size, tint):
    W, H, Dt = size
    chaise_w = 0.70 + 0.10 * (W - 2.10) / 0.70  # 2.10m→0.70m, 2.80m→0.80m
    return sofa(name, W, H, 0.85, 2, P.GREIGE, chaise=side, Dt=Dt, chaise_w=chaise_w, tint=tint)


@asset("sofa_l_left.glb", (2.40, 0.82, 1.55), variants=L_SIZES)
def sofa_l_left(tint=None, size=(2.40, 0.82, 1.55)):
    return l_sofa("sofa_l_left", "left", size, tint)


@asset("sofa_l_right.glb", (2.40, 0.82, 1.55), variants=L_SIZES)
def sofa_l_right(tint=None, size=(2.40, 0.82, 1.55)):
    return l_sofa("sofa_l_right", "right", size, tint)


@asset("sofa_bed_open.glb", (1.40, 0.40, 1.90))
def sofa_bed_open(tint=None):
    m = Model("sofa_bed_open")
    fab = m.mat("tint", tint or P.GRAY_FABRIC, rough=0.95)
    base = m.mat("fabric_base", "#6f7277", rough=0.95)
    wood = m.mat("wood", P.WOOD_MED, rough=0.55)
    W, D = 1.40, 1.90
    leg_h, base_top = 0.07, 0.22
    m.box((W - 0.04, base_top - leg_h, D - 0.06), (0, (base_top + leg_h) / 2, 0), base, bevel=0.02, name="base")
    # 座面・倒した背もたれ・延長部の3分割。継ぎ目が折り畳み位置になる
    sections = [0.70, 0.62, 0.58]
    z = -D / 2
    for i, dz in enumerate(sections):
        th = 0.18 if i != 1 else 0.17
        m.cushion((W, th, dz - 0.008), (0, base_top + th / 2 - 0.01, z + dz / 2), fab,
                  puff=0.2, round_=0.25, cuts=4, name="section")
        z += dz
    e = 0.08
    _legs(m, [(-W / 2 + e, -D / 2 + e), (W / 2 - e, -D / 2 + e), (-W / 2 + e, D / 2 - e), (W / 2 - e, D / 2 - e),
              (-W / 2 + e, -D / 2 + 0.70), (W / 2 - e, -D / 2 + 0.70)], leg_h, wood, r=0.02)
    return m


@asset("chair_dining.glb", (0.45, 0.80, 0.50))
def chair_dining(tint=None):
    m = Model("chair_dining")
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    pad = m.mat("tint", tint or P.BEIGE, rough=0.95)
    lx, lz, s = 0.19, 0.21, 0.042
    for x in (-lx, lx):
        m.box((s, 0.40, s), (x, 0.20, lz), wood, bevel=0.005, name="front_leg")
        m.box((s, 0.80, s), (x, 0.40, -lz), wood, bevel=0.005, rot=(-4, 0, 0), name="rear_leg")
        m.box((0.02, 0.025, 2 * lz), (x, 0.14, 0), wood, bevel=0.004, name="side_stretcher")
    lean = math.tan(math.radians(4))
    m.box((2 * lx, 0.025, 0.02), (0, 0.14, lz), wood, bevel=0.004, name="front_stretcher")
    m.box((0.43, 0.05, 0.46), (0, 0.385, 0), wood, bevel=0.006, name="seat_frame")
    m.cushion((0.42, 0.045, 0.45), (0, 0.43, 0.005), pad, puff=0.35, round_=0.4, cuts=4, name="seat_pad")
    for y, hgt in ((0.74, 0.09), (0.58, 0.035)):
        m.box((2 * lx, hgt, 0.022), (0, y, -lz - (y - 0.40) * lean), wood, bevel=0.006, name="back_rail")
    return m


@asset("chair_office.glb", (0.50, 1.10, 0.50))
def chair_office(tint=None):
    m = Model("chair_office")
    fab = m.mat("tint", tint or P.DARK_FABRIC, rough=0.95)
    metal = m.mat("metal", P.METAL_DARK, rough=0.4, metal=0.6)
    plastic = m.mat("plastic", "#3f3a55", rough=0.6)
    R = 0.215
    m.cyl(0.04, 0.05, (0, 0.085, 0), plastic, seg=16, bevel=0.01, name="hub")
    for k in range(5):
        a = math.radians(90 + 72 * k)
        x, z = R * math.cos(a), R * math.sin(a)
        m.rod((0, 0.09, 0), (x, 0.065, z), 0.017, plastic, seg=8, name="star_arm")
        m.cyl(0.026, 0.022, (x, 0.026, z), plastic, seg=14, axis="x", rot=(0, math.degrees(-a), 0), name="caster")
        m.rod((x, 0.045, z), (x, 0.07, z), 0.008, metal, seg=6, name="caster_stem")
    m.cyl(0.021, 0.33, (0, 0.27, 0), metal, seg=14, name="gas_lift")
    m.cyl(0.03, 0.12, (0, 0.17, 0), plastic, seg=14, r2=0.026, name="shroud")
    m.box((0.22, 0.03, 0.24), (0, 0.44, 0), plastic, bevel=0.006, name="mechanism")
    m.cushion((0.48, 0.08, 0.48), (0, 0.495, 0.01), fab, puff=0.3, round_=0.4, cuts=4, name="seat")
    m.box((0.05, 0.02, 0.16), (0, 0.45, -0.13), metal, bevel=0.005, name="back_bar_low")
    m.rod((0, 0.455, -0.2), (0, 0.72, -0.215), 0.02, metal, seg=10, name="back_bar")
    m.cushion((0.44, 0.50, 0.07), (0, 0.85, -0.205), fab, puff=0.3, round_=0.4, cuts=4, rot=(-8, 0, 0), name="back")
    return m


@asset("stool_round.glb", (0.35, 0.45, 0.35))
def stool_round(tint=None):
    m = Model("stool_round")
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    top = m.mat("tint", tint or P.IVORY, rough=0.8)
    m.cyl(0.175, 0.035, (0, 0.4325, 0), top, seg=40, bevel=0.012, bseg=3, name="seat")
    m.cyl(0.13, 0.02, (0, 0.405, 0), wood, seg=32, name="seat_ring")
    legs = []
    for k in range(4):
        a = math.radians(45 + 90 * k)
        top_p = (0.105 * math.cos(a), 0.41, 0.105 * math.sin(a))
        bot_p = (0.155 * math.cos(a), 0.0, 0.155 * math.sin(a))
        m.rod(bot_p, top_p, 0.016, wood, seg=10, r2=0.019, name="leg")
        t = 0.38
        legs.append(tuple(b + (c - b) * t for b, c in zip(bot_p, top_p)))
    for k in range(4):
        m.rod(legs[k], legs[(k + 1) % 4], 0.009, wood, seg=8, name="stretcher")
    return m


# ---------- 追加モデル (2026-10-04) ----------

@asset("ottoman_round.glb", (0.45, 0.40, 0.45))
def ottoman_round(tint=None):
    m = Model("ottoman_round")
    fab = m.mat("tint", tint or "#c9b8a6", rough=0.95)
    seam = m.mat("piping", "#a8968a", rough=0.95)
    m.lathe([(0.0, 0.0), (0.2, 0.0), (0.218, 0.015), (0.225, 0.05), (0.225, 0.34), (0.218, 0.375), (0.2, 0.395),
             (0.12, 0.4), (0.0, 0.398)], (0, 0, 0), fab, seg=40, name="body")
    m.lathe([(0.226, 0.355), (0.231, 0.36), (0.226, 0.366), (0.221, 0.36)], (0, 0, 0), seam, seg=40, closed=True,
            name="piping")
    m.cyl(0.018, 0.012, (0, 0.398, 0), seam, seg=12, bevel=0.004, name="button")
    return m


@asset("bench_wood.glb", (1.00, 0.45, 0.35))
def bench_wood(tint=None):
    m = Model("bench_wood")
    wood = m.mat("wood", tint or P.WOOD_LIGHT, rough=0.55)
    W, H, D, t = 1.00, 0.45, 0.35, 0.04
    m.box((W, t, D), (0, H - t / 2, 0), wood, bevel=0.01, name="seat")
    feet = []
    for sx in (-1, 1):
        for sz in (-1, 1):
            top = (sx * (W / 2 - 0.1), H - t, sz * (D / 2 - 0.07))
            bottom = (sx * (W / 2 - 0.06), 0.0, sz * (D / 2 - 0.04))
            m.rod(bottom, top, 0.019, wood, seg=12, r2=0.024, name="leg")
            feet.append(tuple(b + (c - b) * 0.35 for b, c in zip(bottom, top)))
    for a, b in ((0, 1), (2, 3)):
        m.rod(feet[a], feet[b], 0.012, wood, seg=8, name="stretcher")
    m.rod(((feet[0][0] + feet[1][0]) / 2, feet[0][1], 0), ((feet[2][0] + feet[3][0]) / 2, feet[2][1], 0), 0.012, wood,
          seg=8, name="stretcher")
    return m


@asset("chair_lounge.glb", (0.70, 0.75, 0.75))
def chair_lounge(tint=None):
    m = Model("chair_lounge")
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    fab = m.mat("tint", tint or "#b8c4b0", rough=0.95)
    W, D = 0.70, 0.75
    s = 0.045
    for sx in (-1, 1):
        x = sx * (W / 2 - s / 2)
        m.box((s, 0.56, s), (x, 0.28, D / 2 - 0.08), wood, bevel=0.006, name="front_leg")
        m.box((s, 0.5, s), (x, 0.25, -D / 2 + 0.1), wood, bevel=0.006, rot=(-6, 0, 0), name="back_leg")
        m.box((s + 0.02, 0.035, D - 0.06), (x, 0.56, 0.0), wood, bevel=0.008, name="arm")
        m.box((s, 0.04, D - 0.14), (x, 0.2, 0.0), wood, bevel=0.005, name="side_rail")
    for z in (D / 2 - 0.08, -D / 2 + 0.1):
        m.box((W - 2 * s, 0.05, 0.03), (0, 0.24, z), wood, bevel=0.005, name="cross_rail")
    m.cushion((W - 2 * s - 0.01, 0.13, 0.62), (0, 0.32, 0.03), fab, puff=0.3, round_=0.35, cuts=4, rot=(-3, 0, 0),
              name="seat")
    m.cushion((W - 2 * s - 0.03, 0.46, 0.12), (0, 0.52, -0.27), fab, puff=0.3, round_=0.35, cuts=4, rot=(-16, 0, 0),
              name="back")
    m.box((W - 2 * s, 0.04, 0.025), (0, 0.6, -0.355), wood, bevel=0.005, rot=(-16, 0, 0), name="back_rail")
    return m


@asset("beanbag.glb", (0.65, 0.45, 0.65))
def beanbag(tint=None):
    m = Model("beanbag")
    fab = m.mat("tint", tint or "#cdb4d6", rough=0.95)
    profile = [(0.0, 0.0), (0.26, 0.0), (0.31, 0.04), (0.325, 0.13), (0.31, 0.25), (0.26, 0.35), (0.17, 0.42),
               (0.07, 0.448), (0.0, 0.45)]
    # くぼみで下がる分を見込んで高めに作る
    ob = m.lathe([(r, y * 1.1) for r, y in profile], (0, 0, 0), fab, seg=36, name="body")
    import math

    def sag(co):
        # 座った跡のくぼみと、少し前へ流れたシルエット
        r2 = co.x * co.x + (co.z - 0.05) * (co.z - 0.05)
        if co.y > 0.2:
            co.y -= 0.09 * math.exp(-r2 / 0.025) * (co.y - 0.2) / 0.25
        co.z += 0.03 * (co.y / 0.45) * (1 if co.z > 0 else 0.3)
        return co

    m.deform(ob, sag)
    ob.data.set_sharp_from_angle(angle=math.pi)
    return m


@asset("floor_chair.glb", (0.45, 0.55, 0.55))
def floor_chair(tint=None):
    m = Model("floor_chair")
    fab = m.mat("tint", tint or "#9fa9b8", rough=0.95)
    frame = m.mat("frame", "#5b566b", rough=0.8)
    m.box((0.43, 0.03, 0.50), (0, 0.015, 0.02), frame, bevel=0.008, name="base")
    m.cushion((0.45, 0.1, 0.5), (0, 0.075, 0.025), fab, puff=0.3, round_=0.35, cuts=4, name="seat")
    m.box((0.38, 0.38, 0.03), (0, 0.27, -0.205), frame, bevel=0.008, rot=(-22, 0, 0), name="back_frame")
    m.cushion((0.44, 0.47, 0.1), (0, 0.33, -0.165), fab, puff=0.3, round_=0.35, cuts=4, rot=(-22, 0, 0), name="back")
    return m
