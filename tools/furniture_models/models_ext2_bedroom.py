"""追加の寝室まわり 第2弾 (ベッド・布団・ベビーベッド・ラグ・カーテン・クッション・小物)。
ベッドは頭側 -Z、足元 +Z。"""
import math

from mathutils import Matrix

import palette as P
from lib import Model, asset, rot_matrix, rrect


def _mattress(m, W, D, y0, body_h, top_h, top, side, cuts=5, cz=0.0, cx=0.0):
    """側面帯 + 上面のふくらみ。y0 は底面。"""
    m.box((W, body_h, D), (cx, y0 + body_h / 2, cz), side, bevel=0.03, seg=3, name="mattress_body")
    m.cushion((W + 0.004, top_h, D + 0.004), (cx, y0 + body_h + top_h / 2 - 0.02, cz), top, puff=0.3, round_=0.45,
              cuts=cuts, name="mattress_top")


def _ellipse(rx, rz, seg=64):
    return [(rx * math.cos(math.tau * i / seg), rz * math.sin(math.tau * i / seg)) for i in range(seg)]


def _arch(w, y0, ys, rise, seg=16):
    """正面図 (x, y) のアーチ板。y0 から ys まで直線、上は高さ rise の楕円弧。"""
    pts = [(-w / 2, y0), (w / 2, y0)]
    for i in range(seg + 1):
        a = math.pi * i / seg
        pts.append((w / 2 * math.cos(a), ys + rise * math.sin(a)))
    return pts


# ---------- ベッド ----------

@asset("bed_headboard_double.glb", (1.40, 0.90, 2.10))
def bed_headboard_double(tint=None):
    m = Model("bed_headboard_double")
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    uph = m.mat("tint", tint or "#c3b2dd", rough=0.95)
    top = m.mat("mattress", P.MATTRESS, rough=0.9)
    side = m.mat("mattress_side", P.MATTRESS_SIDE, rough=0.9)
    W, D, H = 1.40, 2.10, 0.90
    hb_t = 0.10
    z_head = -D / 2
    z0, z1 = z_head + hb_t, D / 2  # ベッド本体
    fd = z1 - z0
    fz = (z0 + z1) / 2
    # ヘッドボード: 木の枠 + 縦の溝のある布張り
    m.box((W, H, 0.05), (0, H / 2, z_head + 0.025), wood, bevel=0.012, seg=2, name="hb_frame")
    n = 5
    pw = (W - 0.10) / n
    for i in range(n):
        x = -(W - 0.10) / 2 + pw * (i + 0.5)
        m.cushion((pw - 0.006, 0.58, 0.07), (x, 0.555, z_head + 0.05 + 0.03), uph, puff=0.35, round_=0.45, cuts=3,
                  name="hb_channel")
    # フレーム
    leg_h, rail_top, rail_t = 0.10, 0.30, 0.045
    rail_h = rail_top - leg_h
    for sx in (-1, 1):
        m.box((rail_t, rail_h, fd), (sx * (W / 2 - rail_t / 2), leg_h + rail_h / 2, fz), wood, bevel=0.008,
              name="side_rail")
    m.box((W - 2 * rail_t, rail_h, rail_t), (0, leg_h + rail_h / 2, z1 - rail_t / 2), wood, bevel=0.008,
          name="foot_rail")
    m.box((W - 2 * rail_t, 0.02, fd - rail_t), (0, 0.20, fz - rail_t / 2), wood, bevel=0.0, name="deck")
    for sx in (-1, 0, 1):
        for zz in (z0 + 0.04, z1 - 0.04):
            m.box((0.06, leg_h + 0.02, 0.06), (sx * (W / 2 - 0.04), (leg_h + 0.02) / 2, zz), wood, bevel=0.006,
                  name="leg")
    mw, md = W - 2 * rail_t - 0.01, fd - rail_t - 0.02
    mz = z0 + 0.01 + md / 2
    _mattress(m, mw, md, 0.21, 0.24, 0.07, top, side, cuts=6, cz=mz)
    # 枕2つ
    for sx in (-1, 1):
        m.cushion((0.58, 0.13, 0.36), (sx * 0.31, 0.50 + 0.05, z0 + 0.25), top, puff=0.75, round_=0.5, cuts=5,
                  pinch=0.06, name="pillow")
    return m


@asset("bed_canopy.glb", (1.10, 2.00, 2.05))
def bed_canopy(tint=None):
    m = Model("bed_canopy")
    sheer = m.mat("tint", tint or "#f2c6d3", rough=0.9, alpha=0.55)
    frame = m.mat("wood", "#efd8c6", rough=0.6)
    top = m.mat("mattress", P.MATTRESS, rough=0.9)
    side = m.mat("mattress_side", "#f3dde3", rough=0.9)
    W, D, H = 1.10, 2.05, 2.00
    pr = 0.024
    px, pz = W / 2 - pr, D / 2 - pr
    yt = H - 0.03
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.cyl(pr, yt, (sx * px, yt / 2, sz * pz), frame, seg=12, name="post")
            m.sphere(0.03, (sx * px, H - 0.03, sz * pz), frame, seg=12, rings=8, name="finial")
            m.box((0.06, 0.03, 0.06), (sx * px, 0.015, sz * pz), frame, bevel=0.006, name="foot")
    # 天井枠
    for sx in (-1, 1):
        m.cyl(0.016, 2 * pz, (sx * px, yt, 0), frame, seg=10, axis="z", name="top_rail")
    for sz in (-1, 1):
        m.cyl(0.016, 2 * px, (0, yt, sz * pz), frame, seg=10, axis="x", name="top_rail")
    # 寝台
    rail_h = 0.18
    for sx in (-1, 1):
        m.box((0.035, rail_h, 2 * pz), (sx * px, 0.10 + rail_h / 2, 0), frame, bevel=0.006, name="side_rail")
    for sz in (-1, 1):
        m.box((2 * px, rail_h, 0.035), (0, 0.10 + rail_h / 2, sz * pz), frame, bevel=0.006, name="end_rail")
    m.box((2 * px - 0.04, 0.02, 2 * pz - 0.04), (0, 0.18, 0), frame, bevel=0.0, name="deck")
    # 頭側のアーチ板と足元の低い板
    m.prism(_arch(2 * px - 0.02, 0.28, 0.75, 0.25), 0.03, frame, plane="xy", offset=-pz - 0.005, bevel=0.008,
            name="headboard")
    m.prism(_arch(2 * px - 0.02, 0.28, 0.40, 0.10), 0.03, frame, plane="xy", offset=pz - 0.025, bevel=0.008,
            name="footboard")
    _mattress(m, 2 * px - 0.06, 2 * pz - 0.08, 0.19, 0.20, 0.07, top, side, cuts=4)
    m.cushion((0.62, 0.14, 0.38), (0, 0.48, -pz + 0.28), top, puff=0.75, round_=0.5, cuts=5, pinch=0.06,
              name="pillow")
    # 上部の飾り布 (四辺でたるむ)
    fx = px + pr * 0.4

    def swag(length, along_x, s):
        def fn(u, v):
            t = (u - 0.5) * length
            drop = 0.08 + 0.16 * math.sin(math.pi * u)
            y = yt + 0.01 - v * drop
            off = 0.008 * math.sin(math.tau * 4 * u) * v
            if along_x:
                return (t, y, s * (pz + pr * 0.4) + off * s)
            return (s * fx + off * s, y, t)
        return fn

    for s in (-1, 1):
        m.surface(19, 5, swag(2 * pz, False, s), sheer, thickness=0.003, name="swag")
        m.surface(13, 5, swag(2 * px, True, s), sheer, thickness=0.003, name="swag")
    # 四隅の柱に寄せて結んだ布 (長辺側)
    y_tie = 1.05
    for sx in (-1, 1):
        for sz in (-1, 1):
            z_post = sz * pz

            def drape(u, v, sx=sx, sz=sz, z_post=z_post):
                y = 0.03 + v * (yt - 0.04)
                if y >= y_tie:
                    t = (y - y_tie) / (yt - y_tie)
                    width = 0.07 + 0.30 * t ** 0.8
                else:
                    t = (y_tie - y) / y_tie
                    width = 0.07 + 0.16 * math.sin(t * math.pi / 2)
                z = z_post - sz * (0.02 + u * width)
                amp = min(0.02, 0.006 * 0.3 / width)
                x = sx * (fx - 0.012) + amp * math.sin(math.tau * 3 * u)
                return (x, y, z)

            m.surface(11, 14, drape, sheer, thickness=0.003, name="drape")
            m.box((0.05, 0.03, 0.12), (sx * (fx - 0.012), y_tie, z_post - sz * 0.07), frame, bevel=0.012, seg=2,
                  name="tie")
    return m


@asset("daybed.glb", (0.90, 0.70, 2.00))
def daybed(tint=None):
    m = Model("daybed")
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    fab = m.mat("tint", tint or "#b8c9a8", rough=0.95)
    side = m.mat("mattress_side", "#dfe6d6", rough=0.9)
    pil = m.mat("fabric", "#efe2cc", rough=0.95)
    W, H, D = 0.90, 0.70, 2.00
    bt, et = 0.05, 0.05  # 背板・肘板の厚み
    # 台座と脚
    base_y0, base_h = 0.10, 0.18
    m.box((W, base_h, D), (0, base_y0 + base_h / 2, 0), wood, bevel=0.012, name="base")
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.cyl(0.025, base_y0 + 0.01, (sx * (W / 2 - 0.05), (base_y0 + 0.01) / 2, sz * (D / 2 - 0.05)), wood,
                  seg=12, r2=0.03, name="leg")
    # 背もたれ (-X) と両端の肘
    m.box((bt, H - base_y0, D), (-W / 2 + bt / 2, base_y0 + (H - base_y0) / 2, 0), wood, bevel=0.012,
          name="back_panel")
    m.box((bt + 0.02, 0.035, D), (-W / 2 + bt / 2 + 0.005, H - 0.0175, 0), wood, bevel=0.012,
          name="back_cap")
    arm_h = 0.58
    for sz in (-1, 1):
        m.box((W - bt, arm_h - base_y0, et), (bt / 2, base_y0 + (arm_h - base_y0) / 2, sz * (D / 2 - et / 2)), wood,
              bevel=0.012, name="arm_panel")
        m.cyl(0.03, W - bt, (bt / 2, arm_h - 0.005, sz * (D / 2 - et / 2)), wood, seg=14, axis="x",
              name="arm_roll")
    # マットレス
    mw, md = W - bt - 0.02, D - 2 * et - 0.02
    _mattress(m, mw, md, base_y0 + base_h, 0.10, 0.07, fab, side, cuts=6, cx=bt / 2)
    # 背もたれに立てかけたクッション3つ
    seat_y = base_y0 + base_h + 0.15
    for z in (-0.58, 0.0, 0.58):
        m.cushion((0.13, 0.29, 0.54), (-W / 2 + bt + 0.085, seat_y + 0.11, z), pil, puff=0.6, round_=0.5, cuts=4,
                  pinch=0.05, rot=(0, 0, 10), name="back_cushion")
    return m


@asset("bed_kids.glb", (0.80, 0.70, 1.50))
def bed_kids(tint=None):
    m = Model("bed_kids")
    frame = m.mat("tint", tint or "#a9d6c4", rough=0.6)
    top = m.mat("mattress", "#fbeef0", rough=0.9)
    side = m.mat("mattress_side", "#f3dfe6", rough=0.9)
    trim = m.mat("trim", "#f4c58f", rough=0.7)
    W, H, D = 0.80, 0.70, 1.50
    t = 0.035
    # 頭側の丸いヘッドボードと足元の低い板
    m.prism(_arch(W, 0.0, 0.42, H - 0.42, 20), t, frame, plane="xy", offset=-D / 2, bevel=0.012, name="headboard")
    m.prism(_arch(W, 0.0, 0.34, 0.14, 16), t, frame, plane="xy", offset=D / 2 - t, bevel=0.012, name="footboard")
    m.cyl(0.10, 0.012, (0, 0.50, -D / 2 + t + 0.004), trim, seg=24, axis="z", bevel=0.004, name="hb_circle")
    m.cyl(0.05, 0.012, (0, 0.30, D / 2 + 0.004), trim, seg=20, axis="z", bevel=0.004, name="fb_circle")
    # 側面の枠と床板
    iz = D - 2 * t
    for sx in (-1, 1):
        m.box((0.035, 0.12, iz), (sx * (W / 2 - 0.0175), 0.14, 0), frame, bevel=0.008, name="side_rail")
    m.box((W - 0.07, 0.018, iz), (0, 0.14, 0), frame, bevel=0.0, name="deck")
    # マットレス
    _mattress(m, W - 0.09, iz - 0.02, 0.15, 0.12, 0.06, top, side, cuts=5)
    # 落下防止の低い柵 (頭側寄り、両側)
    gz0, gz1 = -D / 2 + t, -D / 2 + t + 0.70
    for sx in (-1, 1):
        x = sx * (W / 2 - 0.018)
        m.cyl(0.018, gz1 - gz0, (x, 0.47, (gz0 + gz1) / 2), frame, seg=12, axis="z", name="guard_top")
        m.sphere(0.024, (x, 0.47, gz1), trim, seg=12, rings=8, name="guard_knob")
        for i in range(4):
            z = gz0 + 0.10 + i * (gz1 - gz0 - 0.10) / 3.6
            m.box((0.024, 0.27, 0.035), (x, 0.335, z), frame, bevel=0.008, name="guard_post")
    return m


@asset("crib.glb", (0.70, 1.00, 1.25))
def crib(tint=None):
    m = Model("crib")
    frame = m.mat("tint", tint or "#f1dcc2", rough=0.6)
    top = m.mat("mattress", "#d6e6f2", rough=0.9)
    side = m.mat("mattress_side", "#ecf1f6", rough=0.9)
    caster = m.mat("caster", "#a9a3bc", rough=0.7)
    W, H, D = 0.70, 1.00, 1.25
    p = 0.045
    px, pz = W / 2 - p / 2, D / 2 - p / 2
    cy = 0.05  # キャスターの高さ
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box((p, H - cy, p), (sx * px, cy + (H - cy) / 2, sz * pz), frame, bevel=0.01, name="post")
            m.cyl(0.024, 0.02, (sx * px, 0.027, sz * pz), caster, seg=14, axis="x", bevel=0.006, name="caster")
            m.box((0.03, 0.02, 0.03), (sx * px, cy - 0.01, sz * pz), caster, bevel=0.004, name="caster_fork")
    y_lo, y_hi = 0.27, H - 0.06
    iw, idp = W - 2 * p, D - 2 * p
    for y in (y_lo, y_hi):
        for sx in (-1, 1):
            m.box((0.035, 0.05, idp), (sx * px, y, 0), frame, bevel=0.008, name="long_rail")
        for sz in (-1, 1):
            m.box((iw, 0.05, 0.035), (0, y, sz * pz), frame, bevel=0.008, name="end_rail")
    # 柵の格子
    sl = y_hi - y_lo - 0.05
    sy = (y_lo + y_hi) / 2
    n_long = 11
    for sx in (-1, 1):
        for i in range(n_long):
            z = -idp / 2 + (i + 1) * idp / (n_long + 1)
            m.box((0.022, sl, 0.022), (sx * px, sy, z), frame, bevel=0.006, name="slat")
    # 頭・足元は上部を板にし、その下を格子にする
    for sz in (-1, 1):
        m.prism(_arch(iw, y_hi - 0.20, y_hi - 0.05, 0.08, 12), 0.025, frame, plane="xy", offset=sz * pz - 0.0125,
                bevel=0.006, name="end_panel")
        for i in range(5):
            x = -iw / 2 + (i + 1) * iw / 6
            m.box((0.022, y_hi - 0.20 - y_lo, 0.022), (x, (y_hi - 0.20 + y_lo) / 2, sz * pz), frame, bevel=0.006,
                  name="slat")
    # 床板とマットレス
    m.box((iw, 0.02, idp), (0, y_lo + 0.035, 0), frame, bevel=0.0, name="deck")
    _mattress(m, iw - 0.01, idp - 0.01, y_lo + 0.045, 0.08, 0.05, top, side, cuts=4)
    return m


# ---------- 布団 ----------

@asset("futon_set.glb", (1.00, 0.25, 2.10))
def futon_set(tint=None):
    m = Model("futon_set")
    cover = m.mat("tint", tint or "#c9b6e4", rough=0.95)
    shiki = m.mat("fabric", "#f1ece0", rough=0.95)
    pil = m.mat("pillow", "#e9eef6", rough=0.95)
    W, D = 1.00, 2.10
    sh = 0.08
    m.cushion((W, sh, D), (0, sh / 2, 0), shiki, puff=0.45, round_=0.45, cuts=8, name="shikibuton")
    # 掛け布団: 頭側を少し折り返す
    kw, kz0, kz1 = W - 0.03, -0.45, D / 2 - 0.02
    kh = 0.10
    ob = m.cushion((kw, kh, kz1 - kz0), (0, sh + kh / 2 - 0.015, (kz0 + kz1) / 2), cover, puff=0.55, round_=0.45,
                   cuts=10, name="kakebuton")

    def ripple(co):
        if co.y > sh + 0.02:
            u = co.x / (kw / 2)
            co.y += 0.008 * math.sin(5 * u + 3 * co.z) * math.sin(2.5 * co.z + 1)
        return co

    m.deform(ob, ripple)
    m.cushion((kw - 0.01, 0.09, 0.28), (0, sh + kh + 0.023, kz0 + 0.14), cover, puff=0.5, round_=0.5, cuts=6,
              name="fold")
    m.cushion((0.56, 0.13, 0.36), (0, sh + 0.05, -D / 2 + 0.27), pil, puff=0.75, round_=0.5, cuts=6, pinch=0.06,
              name="pillow")
    return m


@asset("body_pillow.glb", (1.20, 0.25, 0.30))
def body_pillow(tint=None):
    m = Model("body_pillow")
    fab = m.mat("tint", tint or "#f2c6cf", rough=0.95)
    trim = m.mat("trim", "#efe2cc", rough=0.9)
    L, R = 1.20, 0.125
    prof = [(0.0, -L / 2)]
    for i in range(1, 7):  # 丸い端
        a = math.pi / 2 * i / 6
        prof.append((R * math.sin(a), -L / 2 + R * 0.8 * (1 - math.cos(a))))
    for i in range(1, 8):  # 中央がわずかに太い胴
        y = -L / 2 + R * 0.8 + (L - 2 * R * 0.8) * i / 8
        prof.append((R * (1 + 0.04 * math.sin(math.pi * i / 8)), y))
    for i in range(6, -1, -1):
        a = math.pi / 2 * i / 6
        prof.append((R * math.sin(a), L / 2 - R * 0.8 * (1 - math.cos(a))))
    ob = m.lathe(prof, (0, 0, 0), fab, seg=24, name="body")
    me = ob.data
    me.transform(rot_matrix((0, 0, 90)))  # Y軸 → X軸
    me.transform(Matrix.Diagonal((1.0, 1.0, 0.30 / 0.25 * 0.97, 1.0)))
    me.transform(Matrix.Translation((0, R, 0)))
    me.set_sharp_from_angle(angle=math.pi)
    # 両端近くの縫い目の帯
    for sx in (-1, 1):
        ring = m.lathe([(R * 1.015, -0.012), (R * 1.015, 0.012)], (0, 0, 0), trim, seg=24, cap_bottom=False,
                       cap_top=False, name="band")
        ring.modifiers.new("solid", "SOLIDIFY").thickness = 0.006
        m.apply(ring)
        rm = ring.data
        rm.transform(rot_matrix((0, 0, 90)))
        rm.transform(Matrix.Diagonal((1.0, 1.0, 0.30 / 0.25 * 0.97, 1.0)))
        rm.transform(Matrix.Translation((sx * (L / 2 - 0.16), R, 0)))
    return m


# ---------- ラグ ----------

@asset("rug_checker.glb", (1.40, 0.02, 2.00))
def rug_checker(tint=None):
    m = Model("rug_checker")
    a = m.mat("tint", tint or "#c9b6e4", rough=1.0)
    b = m.mat("check", "#f1e7d6", rough=1.0)
    W, H, D = 1.40, 0.016, 2.00
    nx, nz = 7, 10
    tw, td = W / nx, D / nz
    m.prism(rrect(W, D, 0.02, 3), H * 0.6, b, plane="xz", offset=0.0, bevel=0.003, name="base")
    for i in range(nx):
        for j in range(nz):
            mat = a if (i + j) % 2 == 0 else b
            x = -W / 2 + tw * (i + 0.5)
            z = -D / 2 + td * (j + 0.5)
            m.box((tw - 0.004, H * 0.6, td - 0.004), (x, H * 0.7, z), mat, bevel=0.002, seg=1, name="tile")
    return m


@asset("rug_oval.glb", (1.20, 0.02, 1.80))
def rug_oval(tint=None):
    m = Model("rug_oval")
    pile = m.mat("tint", tint or "#d8c3a5", rough=1.0)
    trim = m.mat("trim", "#a88a6c", rough=0.95)
    W, D = 1.20, 1.80
    m.prism(_ellipse(W / 2, D / 2), 0.012, trim, plane="xz", offset=0.0, bevel=0.004, name="trim")
    m.prism(_ellipse(W / 2 - 0.035, D / 2 - 0.035), 0.012, pile, plane="xz", offset=0.004, bevel=0.004, name="pile")
    m.prism(_ellipse(W / 2 - 0.12, D / 2 - 0.12), 0.010, trim, plane="xz", offset=0.008, bevel=0.003, name="ring")
    m.prism(_ellipse(W / 2 - 0.15, D / 2 - 0.15), 0.010, pile, plane="xz", offset=0.010, bevel=0.003, name="center")
    return m


# ---------- カーテン ----------

@asset("curtain_tieback.glb", (1.60, 2.00, 0.12))
def curtain_tieback(tint=None):
    m = Model("curtain_tieback")
    fab = m.mat("tint", tint or "#b9a3e3", rough=0.95)
    trim = m.mat("trim", "#e2bf86", rough=0.7)
    rod = m.mat("wood", P.WOOD_MED, rough=0.55)
    W, H = 1.60, 2.00
    y_rod = H - 0.03
    y_top, y_tie = y_rod, 0.95
    x_out = W / 2 - 0.04
    m.cyl(0.016, W - 0.06, (0, y_rod, 0), rod, seg=14, axis="x", name="rod")
    for sx in (-1, 1):
        m.sphere(0.03, (sx * (W / 2 - 0.03), y_rod, 0), rod, seg=14, rings=8, name="finial")
    tie_w = 0.15
    for sx in (-1, 1):
        def fn(u, v, sx=sx):
            y = 0.0 + v * (y_top - 0.0)
            if y >= y_tie:
                t = (y - y_tie) / (y_top - y_tie)
                x_in = (x_out - tie_w) + (0.03 - (x_out - tie_w)) * t ** 0.75
            else:
                t = (y_tie - y) / y_tie
                x_in = (x_out - tie_w) - 0.14 * math.sin(t * math.pi / 2)
            width = x_out - x_in
            amp = min(0.042, 0.011 * 0.72 / width)
            x = x_in + width * u
            z = amp * math.sin(math.tau * 7 * u + 0.4)
            return (sx * x, y, z)

        m.surface(36, 22, fn, fab, thickness=0.006, name="panel")
        # 留め具 (タッセル)
        cx = sx * (x_out - tie_w / 2)
        m.cushion((tie_w + 0.05, 0.045, 0.115), (cx, y_tie, 0.0), trim, puff=0.2, round_=0.5, cuts=2, name="tieback")
        tx = sx * (x_out - tie_w / 2 - 0.03)
        m.sphere(0.018, (tx, y_tie - 0.035, 0.05), trim, seg=12, rings=8, name="tassel_knob")
        m.lathe([(0.0, -0.10), (0.022, -0.095), (0.016, -0.03), (0.008, 0.0)], (tx, y_tie - 0.04, 0.05), trim, seg=12,
                name="tassel")
    return m


# ---------- クッション・枕 ----------

@asset("cushion_round.glb", (0.40, 0.14, 0.40))
def cushion_round(tint=None):
    m = Model("cushion_round")
    fab = m.mat("tint", tint or "#f0c9a8", rough=0.95)
    btn = m.mat("button", "#c79a7a", rough=0.8)
    prof = [(0.0, 0.008), (0.08, 0.0), (0.15, 0.003), (0.185, 0.026), (0.20, 0.070), (0.185, 0.114),
            (0.15, 0.137), (0.08, 0.140), (0.03, 0.126), (0.0, 0.122)]
    ob = m.lathe(prof, (0, 0, 0), fab, seg=40, name="cushion")
    ob.data.set_sharp_from_angle(angle=math.pi)
    m.cyl(0.022, 0.014, (0, 0.126, 0), btn, seg=16, bevel=0.006, name="button")
    return m


# ---------- スツール ----------

@asset("vanity_stool.glb", (0.40, 0.45, 0.35))
def vanity_stool(tint=None):
    m = Model("vanity_stool")
    fab = m.mat("tint", tint or "#e8bfcd", rough=0.95)
    wood = m.mat("wood", "#efd8c6", rough=0.6)
    W, H, D = 0.40, 0.45, 0.35
    m.cushion((W, 0.10, D), (0, H - 0.05, 0), fab, puff=0.45, round_=0.5, cuts=4, pinch=0.04, name="seat")
    m.box((W - 0.06, 0.06, D - 0.06), (0, H - 0.115, 0), wood, bevel=0.01, name="apron")
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.rod((sx * 0.172, 0.0, sz * 0.143), (sx * 0.15, H - 0.09, sz * 0.12), 0.011, wood, seg=10, r2=0.018,
                  name="leg")
    for sz in (-1, 1):
        m.rod((-0.16, 0.12, sz * 0.13), (0.16, 0.12, sz * 0.13), 0.008, wood, seg=8, name="stretcher")
    return m


# ---------- 小物 ----------

@asset("slippers.glb", (0.25, 0.06, 0.28))
def slippers(tint=None):
    m = Model("slippers")
    fab = m.mat("tint", tint or "#c9b6e4", rough=1.0)
    sole = m.mat("sole", "#e9dcc8", rough=0.9)
    L, hw_max, sole_h = 0.275, 0.055, 0.018

    def hw(s):
        s = min(max(s, 0.0), 1.0)
        return hw_max * math.sin(math.pi * s) ** 0.45 * (0.86 + 0.14 * s) / 1.0

    n = 28
    for sx in (-1, 1):
        cx = sx * 0.068
        right = [(cx + hw(i / n), -L / 2 + L * i / n) for i in range(n + 1)]
        left = [(cx - hw(i / n), -L / 2 + L * i / n) for i in range(n - 1, 0, -1)]
        m.prism(right + left, sole_h, sole, plane="xz", offset=0.0, bevel=0.006, seg=2, name="sole")
        # 甲の覆い (前半分)
        s0, s1 = 0.48, 1.0

        def upper(u, v, cx=cx):
            s = s0 + (s1 - s0) * v
            z = -L / 2 + L * s
            rx = hw(s) - 0.004
            ry = 0.036 * (hw(s) / hw_max) ** 0.9
            a = math.pi * u
            return (cx + rx * math.cos(a), sole_h - 0.002 + ry * math.sin(a), z)

        m.surface(13, 9, upper, fab, thickness=0.01, name="upper")
        # 中敷き
        inner = [(x, z) for x, z in right[2:-2]] + [(x, z) for x, z in left[1:-1]]
        sc = 0.88
        inner = [(cx + (x - cx) * sc, z * 0.95) for x, z in inner]
        m.prism(inner, 0.004, fab, plane="xz", offset=sole_h - 0.001, bevel=0.0, name="insole")
    return m
