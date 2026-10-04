"""追加の寝室・デスクまわり (昇降デスク・ゲーミングチェア・ノートPC・ベッド類・寝具・ラグ・ロールスクリーン)。
ベッドは頭側 -Z、足元 +Z。"""
import math

import palette as P
from lib import Model, asset, rrect


def _rx(y, z, deg):
    """X軸まわりの回転 (y, z)。負の角度で上側が奥 (-Z) へ倒れる。"""
    a = math.radians(deg)
    return y * math.cos(a) - z * math.sin(a), y * math.sin(a) + z * math.cos(a)


def _tilted(pivot, local, deg):
    y, z = _rx(local[1], local[2], deg)
    return (pivot[0] + local[0], pivot[1] + y, pivot[2] + z)


def _mattress(m, W, D, y0, body_h, top_h, top, side, cuts=5):
    """側面帯 + 上面のふくらみ。y0 は底面。"""
    m.box((W, body_h, D), (0, y0 + body_h / 2, 0), side, bevel=0.03, seg=3, name="mattress_body")
    m.cushion((W + 0.004, top_h, D + 0.004), (0, y0 + body_h + top_h / 2 - 0.02, 0), top, puff=0.3, round_=0.45,
              cuts=cuts, name="mattress_top")


# ---------- デスク・チェア・PC ----------

@asset("desk_standing.glb", (1.20, 0.75, 0.70))
def desk_standing(tint=None):
    m = Model("desk_standing")
    top = m.mat("tint", tint or P.WOOD_LIGHT, rough=0.6)
    frame = m.mat("metal", "#e6e2ec", rough=0.5, metal=0.4)
    ctrl = m.mat("plastic", "#4a4562", rough=0.6)
    W, D, H, t = 1.20, 0.70, 0.75, 0.028
    m.prism(rrect(W, D, 0.03), t, top, plane="xz", offset=H - t, bevel=0.007, seg=2, name="top")
    y_under = H - t
    for sx in (-1, 1):
        x = sx * 0.44
        # T字の脚: 床の足・太い外柱・細い内柱・天板下の受け
        m.box((0.075, 0.04, 0.66), (x, 0.02, 0), frame, bevel=0.012, name="foot")
        for sz in (-1, 1):
            m.box((0.055, 0.012, 0.04), (x, 0.006, sz * 0.30), ctrl, bevel=0.003, name="glide")
        m.box((0.085, 0.36, 0.065), (x, 0.04 + 0.18, 0), frame, bevel=0.008, name="column_outer")
        m.box((0.07, 0.30, 0.052), (x, 0.40 + 0.15 - 0.02, 0), frame, bevel=0.006, name="column_inner")
        m.box((0.10, 0.012, 0.075), (x, 0.40, 0), frame, bevel=0.004, name="column_collar")
        m.box((0.06, 0.035, 0.58), (x, y_under - 0.0175, 0), frame, bevel=0.005, name="top_bracket")
    m.box((0.84, 0.05, 0.04), (0, y_under - 0.06, -0.02), frame, bevel=0.006, name="cross_beam")
    # 手前右の操作パネル
    m.box((0.12, 0.022, 0.06), (0.36, y_under - 0.011, D / 2 - 0.05), ctrl, bevel=0.006, name="control_box")
    for i, dx in enumerate((-0.035, 0.0, 0.035)):
        m.box((0.022, 0.006, 0.012), (0.36 + dx, y_under - 0.012, D / 2 - 0.016), frame, bevel=0.002, name="button")
    return m


@asset("chair_gaming.glb", (0.65, 1.30, 0.65))
def chair_gaming(tint=None):
    m = Model("chair_gaming")
    fab = m.mat("tint", tint or "#a98fd6", rough=0.95)
    accent = m.mat("accent", P.DARK_FABRIC, rough=0.9)
    plastic = m.mat("plastic", "#3f3a55", rough=0.6)
    metal = m.mat("metal", "#8a86a0", rough=0.5, metal=0.5)
    R = 0.27
    # 5本脚とキャスター
    m.cyl(0.045, 0.05, (0, 0.09, 0), plastic, seg=16, bevel=0.01, name="hub")
    for k in range(5):
        a = math.radians(90 + 72 * k)
        x, z = R * math.cos(a), R * math.sin(a)
        m.rod((0, 0.095, 0), (x, 0.068, z), 0.02, plastic, seg=8, name="star_arm")
        m.cyl(0.028, 0.024, (x, 0.028, z), plastic, seg=14, axis="x", rot=(0, math.degrees(-a), 0), name="caster")
        m.rod((x, 0.05, z), (x, 0.075, z), 0.009, metal, seg=6, name="caster_stem")
    m.cyl(0.024, 0.30, (0, 0.27, 0), metal, seg=14, name="gas_lift")
    m.cyl(0.034, 0.13, (0, 0.18, 0), plastic, seg=14, r2=0.03, name="shroud")
    m.box((0.26, 0.04, 0.28), (0, 0.42, 0), plastic, bevel=0.008, name="mechanism")
    # 座面: 中央 (tint) + 左右の盛り上がり (accent)
    seat_y = 0.47
    m.cushion((0.36, 0.08, 0.50), (0, seat_y, 0.03), fab, puff=0.3, round_=0.4, cuts=4, name="seat")
    for sx in (-1, 1):
        m.cushion((0.09, 0.11, 0.50), (sx * 0.22, seat_y + 0.012, 0.03), accent, puff=0.25, round_=0.45, cuts=3,
                  name="seat_bolster")
    m.box((0.50, 0.03, 0.46), (0, seat_y - 0.045, 0.03), plastic, bevel=0.008, name="seat_pan")
    # 背もたれ: 少し後傾。中央パネル + 左右のサイドサポート + 肩の張り出し
    tilt = -7
    piv = (0, 0.50, -0.185)
    m.cushion((0.34, 0.74, 0.09), _tilted(piv, (0, 0.38, 0), tilt), fab, puff=0.3, round_=0.4, cuts=3,
              rot=(tilt, 0, 0), name="back")
    for sx in (-1, 1):
        m.cushion((0.11, 0.80, 0.15), _tilted(piv, (sx * 0.21, 0.40, 0.02), tilt), accent, puff=0.2, round_=0.45,
                  cuts=3, rot=(tilt, 0, 0), name="back_bolster")
    m.cushion((0.34, 0.12, 0.11), _tilted(piv, (0, 0.74, 0.0), tilt), accent, puff=0.2, round_=0.45, cuts=3,
              rot=(tilt, 0, 0), name="back_top")
    m.box((0.48, 0.74, 0.04), _tilted(piv, (0, 0.40, -0.06), tilt), accent, bevel=0.02, seg=2, rot=(tilt, 0, 0),
          name="back_shell")
    # ヘッドレストとランバーの枕
    m.cushion((0.24, 0.12, 0.08), _tilted(piv, (0, 0.62, 0.085), tilt), accent, puff=0.6, round_=0.5, cuts=3,
              pinch=0.05, rot=(tilt, 0, 0), name="head_pillow")
    m.cushion((0.28, 0.13, 0.09), _tilted(piv, (0, 0.18, 0.085), tilt), accent, puff=0.6, round_=0.5, cuts=3,
              pinch=0.05, rot=(tilt, 0, 0), name="lumbar_pillow")
    m.box((0.16, 0.12, 0.05), (0, 0.46, -0.17), plastic, bevel=0.008, name="back_bracket")
    # アームレスト
    for sx in (-1, 1):
        x = sx * 0.295
        m.box((0.05, 0.03, 0.14), (sx * 0.27, 0.43, -0.02), plastic, bevel=0.006, name="arm_bracket")
        m.box((0.035, 0.24, 0.05), (x, 0.55, -0.02), plastic, bevel=0.006, name="arm_post")
        m.box((0.075, 0.035, 0.26), (x, 0.685, 0.01), plastic, bevel=0.012, seg=3, name="arm_pad")
    return m


@asset("laptop.glb", (0.33, 0.22, 0.24))
def laptop(tint=None):
    m = Model("laptop")
    body = m.mat("tint", tint or "#cfcadb", rough=0.6)
    screen = m.mat("screen", "#3b3752", rough=0.4)
    keys = m.mat("keys", "#7c7794", rough=0.7)
    W, D, t = 0.33, 0.215, 0.016
    m.box((W, t, D), (0, t / 2, 0), body, bevel=0.005, name="base")
    # キーボードとトラックパッド
    m.box((0.28, 0.003, 0.105), (0, t, -0.035), keys, bevel=0.001, name="keyboard")
    for r in range(5):
        z = -0.078 + r * 0.021
        m.box((0.27, 0.0025, 0.0025), (0, t + 0.0012, z + 0.0105), body, bevel=0.0, name="key_gap")
    m.box((0.10, 0.002, 0.06), (0, t, 0.06), keys, bevel=0.001, name="trackpad")
    # 画面: 奥のヒンジから少し後傾
    hinge = (0, t * 0.6, -D / 2 + 0.006)
    tilt = -9
    lid_h, lid_t = 0.205, 0.008
    m.box((W, lid_h, lid_t), _tilted(hinge, (0, lid_h / 2, -lid_t / 2), tilt), body, bevel=0.004,
          rot=(tilt, 0, 0), name="lid")
    m.box((W - 0.02, lid_h - 0.03, 0.002), _tilted(hinge, (0, lid_h / 2 + 0.006, 0.0005), tilt), screen,
          bevel=0.0, rot=(tilt, 0, 0), name="display")
    m.cyl(0.006, 0.26, (0, t * 0.6, -D / 2 + 0.006), body, seg=10, axis="x", name="hinge")
    return m


# ---------- ベッド ----------

@asset("bed_storage.glb", (1.00, 0.45, 2.00))
def bed_storage(tint=None):
    m = Model("bed_storage")
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    top = m.mat("tint", tint or P.MATTRESS, rough=0.9)
    side = m.mat("mattress_side", P.MATTRESS_SIDE, rough=0.9)
    handle = m.mat("handle", P.WOOD_BROWN, rough=0.6)
    W, D = 1.00, 2.00
    base_h = 0.30
    m.box((W - 0.06, 0.03, D - 0.06), (0, 0.015, 0), handle, bevel=0.004, name="plinth")
    m.box((W - 0.012, base_h - 0.03, D), (-0.006, 0.03 + (base_h - 0.03) / 2, 0), wood, bevel=0.01, name="box")
    # +X側の引き出し2杯
    dl = 0.86
    for z in (-0.46, 0.46):
        m.box((0.014, 0.20, dl), (W / 2 - 0.007, 0.165, z), wood, bevel=0.006, name="drawer_front")
        m.box((0.012, 0.025, 0.18), (W / 2 + 0.001, 0.235, z), handle, bevel=0.005, name="drawer_pull")
    _mattress(m, W - 0.04, D - 0.04, base_h, 0.11, 0.07, top, side)
    return m


@asset("bed_bunk.glb", (1.00, 1.60, 2.05))
def bed_bunk(tint=None):
    m = Model("bed_bunk")
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    top = m.mat("tint", tint or P.MATTRESS, rough=0.9)
    side = m.mat("mattress_side", P.MATTRESS_SIDE, rough=0.9)
    W, D, H = 1.00, 2.00, 1.60
    p = 0.065
    px, pz = W / 2 - p / 2, D / 2 - p / 2
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box((p, H, p), (sx * px, H / 2, sz * pz), wood, bevel=0.008, name="post")
    iw, idp = W - 2 * p, D - 2 * p
    for deck in (0.20, 0.98):
        # 寝台の枠と床板
        for sx in (-1, 1):
            m.box((0.035, 0.12, idp), (sx * (W / 2 - 0.0175), deck, 0), wood, bevel=0.005, name="side_rail")
        for sz in (-1, 1):
            m.box((iw, 0.12, 0.03), (0, deck, sz * (D / 2 - 0.02)), wood, bevel=0.005, name="end_rail")
        m.box((iw, 0.018, idp), (0, deck - 0.03, 0), wood, bevel=0.0, name="deck")
        _mattress(m, iw - 0.02, idp - 0.02, deck - 0.02, 0.09, 0.06, top, side)
    # 頭側の板 (上下とも)
    for y0, y1 in ((0.26, 0.55), (1.04, 1.52)):
        m.box((iw, y1 - y0, 0.022), (0, (y0 + y1) / 2, -(D / 2 - 0.02)), wood, bevel=0.005, name="head_panel")
    # 足元の下段の板
    m.box((iw, 0.14, 0.022), (0, 0.33, D / 2 - 0.02), wood, bevel=0.005, name="foot_panel")
    # 上段の転落防止柵 (両側)
    for sx in (-1, 1):
        for y in (1.30, 1.52):
            m.box((0.03, 0.06, idp), (sx * (W / 2 - 0.02), y, 0), wood, bevel=0.005, name="guard_rail")
        for i in range(4):
            z = -idp / 2 + (i + 1) * idp / 5
            m.box((0.026, 0.22, 0.04), (sx * (W / 2 - 0.02), 1.41, z), wood, bevel=0.004, name="guard_post")
    # 足元 (+Z) のはしご: 右寄り。上段の足元柵ははしご位置を空ける
    lx0, lx1 = 0.08, W / 2 - p
    lz = D / 2 + 0.01
    for x in (lx0,):
        m.box((0.045, 1.52, 0.04), (x, 0.76, lz), wood, bevel=0.005, name="ladder_rail")
    for i in range(5):
        y = 0.30 + i * 0.23 + 0.04
        m.cyl(0.016, lx1 - lx0, ((lx0 + lx1) / 2, y, lz), wood, seg=10, axis="x", name="rung")
    gx0, gx1 = -(W / 2 - p), lx0 - 0.02
    for y in (1.30, 1.52):
        m.box((gx1 - gx0, 0.06, 0.03), ((gx0 + gx1) / 2, y, D / 2 - 0.02), wood, bevel=0.005, name="foot_guard")
    return m


@asset("headboard.glb", (1.00, 0.90, 0.20))
def headboard(tint=None):
    m = Model("headboard")
    wood = m.mat("tint", tint or P.WOOD_LIGHT, rough=0.55)
    inner = m.mat("inner", "#cfae7e", rough=0.6)
    W, H, D = 1.00, 0.90, 0.20
    t = 0.025
    m.box((W, H, 0.03), (0, H / 2, -D / 2 + 0.015), wood, bevel=0.006, name="back_panel")
    for sx in (-1, 1):
        m.box((t, H, D), (sx * (W / 2 - t / 2), H / 2, 0), wood, bevel=0.006, name="side_panel")
    # 上の棚と小物入れ
    shelf_bottom = 0.58
    m.box((W + 0.02, t, D + 0.01), (0, H - t / 2, 0.005), wood, bevel=0.007, name="top_shelf")
    m.box((W - 2 * t, t, D - 0.03), (0, shelf_bottom + t / 2, 0.015), wood, bevel=0.005, name="cubby_bottom")
    cw = (W - 2 * t) / 3
    for i in (1, 2):
        x = -W / 2 + t + i * cw
        m.box((0.02, H - t - shelf_bottom - t, D - 0.03), (x, (shelf_bottom + t + H - t) / 2, 0.015), wood,
              bevel=0.004, name="divider")
    m.box((W - 2 * t, H - t - shelf_bottom - t, 0.004), (0, (shelf_bottom + t + H - t) / 2, -D / 2 + 0.032), inner,
          bevel=0.0, name="cubby_back")
    m.box((W - 2 * t, 0.06, 0.02), (0, 0.03, D / 2 - 0.02), wood, bevel=0.004, name="kick")
    return m


@asset("bed_slatted.glb", (1.00, 0.30, 2.00))
def bed_slatted(tint=None):
    m = Model("bed_slatted")
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    beam = m.mat("wood_dark", P.WOOD_MED, rough=0.55)
    top = m.mat("tint", tint or P.MATTRESS, rough=0.9)
    side = m.mat("mattress_side", P.MATTRESS_SIDE, rough=0.9)
    W, D = 1.00, 2.00
    # 脚と根太 (縦方向3本)
    for x in (-0.40, 0.0, 0.40):
        m.box((0.06, 0.07, D - 0.04), (x, 0.065, 0), beam, bevel=0.006, name="joist")
        for z in (-0.90, 0.0, 0.90):
            m.box((0.07, 0.04, 0.07), (x, 0.02, z), beam, bevel=0.005, name="foot")
    # すのこ板: 横向きに並べ、端と板の隙間が見えるようにする
    n = 18
    pitch = D / n
    sw = pitch * 0.68
    for i in range(n):
        z = -D / 2 + pitch / 2 + i * pitch
        m.box((W, 0.025, sw), (0, 0.1125, z), wood, bevel=0.005, name="slat")
    _mattress(m, 0.88, 1.84, 0.125, 0.11, 0.07, top, side)
    return m


@asset("mattress_floor.glb", (0.97, 0.20, 1.95))
def mattress_floor(tint=None):
    m = Model("mattress_floor")
    top = m.mat("tint", tint or P.MATTRESS, rough=0.9)
    side = m.mat("mattress_side", P.MATTRESS_SIDE, rough=0.9)
    pipe = m.mat("piping", "#b8a9d4", rough=0.9)
    W, D = 0.96, 1.94
    m.box((W, 0.15, D), (0, 0.085, 0), side, bevel=0.03, seg=3, name="body")
    m.cushion((W + 0.004, 0.07, D + 0.004), (0, 0.16, 0), top, puff=0.35, round_=0.45, cuts=6, name="top")
    # 上下のパイピング (角丸の輪)
    for y in (0.012, 0.155):
        m.prism(rrect(W + 0.008, D + 0.008, 0.035, 4), 0.012, pipe, plane="xz", offset=y - 0.006, bevel=0.005,
                name="piping")
    m.box((0.004, 0.06, 0.20), (W / 2 + 0.002, 0.085, 0.55), pipe, bevel=0.0015, name="handle")
    m.box((0.004, 0.06, 0.20), (-W / 2 - 0.002, 0.085, 0.55), pipe, bevel=0.0015, name="handle")
    return m


# ---------- 寝具 ----------

@asset("duvet_set.glb", (1.00, 0.15, 2.00))
def duvet_set(tint=None):
    m = Model("duvet_set")
    fab = m.mat("tint", tint or "#c9b6e4", rough=0.95)
    pil = m.mat("pillow", P.IVORY, rough=0.95)
    W, D = 1.00, 2.00
    z0, z1 = -0.58, D / 2
    L = z1 - z0
    ob = m.cushion((W, 0.09, L), (0, 0.045, (z0 + z1) / 2), fab, puff=0.55, round_=0.45, cuts=10, name="duvet")

    def ripple(co):
        if co.y > 0.03:
            u = co.x / (W / 2)
            co.y += 0.008 * math.sin(6 * u + 4 * co.z) * math.sin(3 * co.z)
        return co

    m.deform(ob, ripple)
    # 頭側の折り返し
    m.cushion((W - 0.01, 0.05, 0.24), (0, 0.095, z0 + 0.12), fab, puff=0.5, round_=0.5, cuts=6, name="fold")
    m.cushion((0.62, 0.15, 0.40), (0, 0.075, -D / 2 + 0.20), pil, puff=0.75, round_=0.5, cuts=6, pinch=0.06,
              name="pillow")
    return m


@asset("pillow.glb", (0.60, 0.12, 0.40))
def pillow(tint=None):
    m = Model("pillow")
    fab = m.mat("tint", tint or P.IVORY, rough=0.95)
    m.cushion((0.60, 0.12, 0.40), (0, 0.06, 0), fab, puff=0.75, round_=0.5, cuts=6, pinch=0.06, name="pillow")
    return m


@asset("seat_cushion.glb", (0.55, 0.07, 0.59))
def seat_cushion(tint=None):
    m = Model("seat_cushion")
    fab = m.mat("tint", tint or "#b79fd9", rough=0.95)
    tuft = m.mat("tuft", "#7b5fae", rough=0.9)
    W, H, D = 0.55, 0.07, 0.59
    ob = m.cushion((W, H, D), (0, H / 2, 0), fab, puff=0.4, round_=0.4, cuts=8, pinch=0.03, name="zabuton")

    def dimple(co):
        if co.y > H / 2:
            r2 = co.x ** 2 + co.z ** 2
            co.y -= 0.022 * math.exp(-r2 / 0.012)
        return co

    m.deform(ob, dimple)
    # 中央の綴じ糸と四隅の房
    top_y = H - 0.022
    for dx, dz in ((0.012, 0), (-0.012, 0), (0, 0.012), (0, -0.012)):
        m.box((0.022 if dx else 0.008, 0.008, 0.008 if dx else 0.022), (dx, top_y + 0.004, dz), tuft, bevel=0.003,
              name="tuft")
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.sphere(0.014, (sx * (W / 2 - 0.016), H / 2, sz * (D / 2 - 0.016)), tuft, seg=10, rings=6,
                     name="corner_tassel")
    return m


@asset("rug_runner.glb", (0.60, 0.02, 1.80))
def rug_runner(tint=None):
    m = Model("rug_runner")
    base = m.mat("tint", tint or "#c9b6e4", rough=1.0)
    stripe = m.mat("stripe", "#8e6cc8", rough=1.0)
    fringe = m.mat("fringe", "#efe6d6", rough=0.95)
    W, H, Lb = 0.60, 0.016, 1.68
    # 横縞: 帯を並べて1枚にする (縁は細い縞)
    bands = [(0.05, stripe), (0.06, base), (0.03, stripe), (0.04, base), (0.03, stripe)]
    seq = bands + [(Lb - 2 * sum(b[0] for b in bands) - 0.16, base)]
    seq = seq[:-1] + [((seq[-1][0]) / 2, base), (0.04, stripe), (0.04, base), (0.04, stripe),
                      ((seq[-1][0]) / 2, base)] + list(reversed(bands))
    total = sum(b[0] for b in seq)
    z = -total / 2
    for length, mat in seq:
        m.box((W, H, length), (0, H / 2, z + length / 2), mat, bevel=0.0, name="band")
        z += length
    # 長辺の縁取り
    for sx in (-1, 1):
        m.box((0.02, H + 0.003, total), (sx * (W / 2 - 0.01), (H + 0.003) / 2, 0), stripe, bevel=0.004, name="edge")
    # 両端のフリンジ
    n = 28
    fl = (1.80 - total) / 2
    for sz in (-1, 1):
        for i in range(n):
            x = -W / 2 + 0.02 + i * (W - 0.04) / (n - 1)
            m.box((0.007, 0.004, fl + 0.005), (x, 0.002, sz * (total / 2 + fl / 2 - 0.0025)), fringe, bevel=0.0,
                  name="fringe")
    return m


@asset("blind_roller.glb", (1.00, 1.80, 0.08))
def blind_roller(tint=None):
    m = Model("blind_roller")
    fab = m.mat("tint", tint or "#e3d6c2", rough=0.95)
    frame = m.mat("frame", "#ece8f0", rough=0.6)
    cord = m.mat("cord", "#8f88a8", rough=0.7)
    W, H, D = 1.00, 1.80, 0.08
    # 上部のヘッドボックス (背面は -Z で平ら)
    m.box((W, 0.09, D), (0, H - 0.045, 0), frame, bevel=0.012, name="head_box")
    m.box((W - 0.04, 0.012, D - 0.03), (0, H - 0.096, 0.0), frame, bevel=0.004, name="head_lip")
    # 布 (少しだけ波打たせる)
    fw = W - 0.04
    top_y, bot_y = H - 0.09, 0.115

    def fn(u, v):
        x = (u - 0.5) * fw
        z = 0.002 * math.sin(u * math.pi * 6) * (1 - v)
        return (x, bot_y + v * (top_y - bot_y), -0.004 + z)

    m.surface(25, 6, fn, fab, thickness=0.004, name="fabric")
    # ウェイトバーと引き紐
    m.box((fw + 0.01, 0.03, 0.022), (0, bot_y - 0.01, -0.004), frame, bevel=0.008, name="bottom_bar")
    m.rod((0, bot_y - 0.025, -0.004), (0, 0.04, -0.004), 0.003, cord, seg=6, name="cord")
    m.cyl(0.012, 0.04, (0, 0.02, -0.004), cord, seg=12, r2=0.008, bevel=0.004, name="pull")
    return m
