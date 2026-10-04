"""ベッド・布団。頭側 -Z、足元 +Z。"""
import palette as P
from lib import Model, asset


def frame_bed(name, W, D, H=0.45, center_legs=False, tint=None):
    m = Model(name)
    wood = m.mat("wood", P.WOOD_LIGHT, rough=0.55)
    mat_top = m.mat("tint", tint or P.MATTRESS, rough=0.9)
    side = m.mat("mattress_side", P.MATTRESS_SIDE, rough=0.9)
    leg_h, rail_top, rail_t = 0.09, 0.27, 0.04
    rail_h = rail_top - leg_h
    # 外周フレーム (サイドレールと前後の板)
    for sx in (-1, 1):
        m.box((rail_t, rail_h, D), (sx * (W / 2 - rail_t / 2), leg_h + rail_h / 2, 0), wood, bevel=0.006, name="side_rail")
    for sz in (-1, 1):
        m.box((W - 2 * rail_t, rail_h, rail_t), (0, leg_h + rail_h / 2, sz * (D / 2 - rail_t / 2)), wood, bevel=0.006,
              name="end_rail")
    # 床板 (外からはほぼ見えない)
    m.box((W - 2 * rail_t, 0.02, D - 2 * rail_t), (0, 0.17, 0), wood, bevel=0.0, name="deck")
    legs = [(sx * (W / 2 - 0.035), sz * (D / 2 - 0.035)) for sx in (-1, 1) for sz in (-1, 1)]
    if center_legs:
        legs += [(0, sz * (D / 2 - 0.035)) for sz in (-1, 1)] + [(0, 0)]
    for x, z in legs:
        m.box((0.06, leg_h + 0.02, 0.06), (x, (leg_h + 0.02) / 2, z), wood, bevel=0.006, name="leg")
    if center_legs:
        m.box((0.05, 0.05, D - 2 * rail_t), (0, 0.155, 0), wood, bevel=0.0, name="center_beam")
    # マットレス: 側面帯と上面のふくらみを分ける
    mw, md = W - 2 * rail_t - 0.01, D - 2 * rail_t - 0.01
    m.box((mw, 0.22, md), (0, 0.18 + 0.11, 0), side, bevel=0.03, seg=3, name="mattress_body")
    m.cushion((mw + 0.004, 0.07, md + 0.004), (0, H - 0.035, 0), mat_top, puff=0.3, round_=0.45, cuts=5,
              name="mattress_top")
    return m


@asset("bed_single.glb", (0.97, 0.45, 1.95))
def bed_single(tint=None):
    return frame_bed("bed_single", 0.97, 1.95, tint=tint)


@asset("bed_semidouble.glb", (1.20, 0.45, 1.95))
def bed_semidouble(tint=None):
    return frame_bed("bed_semidouble", 1.20, 1.95, tint=tint)


@asset("bed_double.glb", (1.40, 0.45, 1.95))
def bed_double(tint=None):
    return frame_bed("bed_double", 1.40, 1.95, center_legs=True, tint=tint)


@asset("bed_loft.glb", (1.05, 1.80, 2.05))
def bed_loft(tint=None):
    m = Model("bed_loft")
    metal = m.mat("metal", P.METAL_DARK, rough=0.45, metal=0.5)
    mat_top = m.mat("tint", tint or P.MATTRESS, rough=0.9)
    side = m.mat("mattress_side", P.MATTRESS_SIDE, rough=0.9)
    W, D, H = 1.05, 2.05, 1.80
    p = 0.05
    px, pz = W / 2 - p / 2, D / 2 - p / 2
    deck_y = 1.28
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box((p, H, p), (sx * px, H / 2, sz * pz), metal, bevel=0.004, name="post")
            m.box((p * 1.4, 0.015, p * 1.4), (sx * px, 0.0075, sz * pz), metal, bevel=0.003, name="foot")
    # 寝台の枠
    for sx in (-1, 1):
        m.box((0.03, 0.08, D - 2 * p), (sx * px, deck_y, 0), metal, bevel=0.003, name="side_frame")
    for sz in (-1, 1):
        m.box((W - 2 * p, 0.08, 0.03), (0, deck_y, sz * pz), metal, bevel=0.003, name="end_frame")
    for i in range(7):
        z = -D / 2 + 0.2 + i * (D - 0.4) / 6
        m.box((W - 2 * p, 0.02, 0.03), (0, deck_y + 0.03, z), metal, bevel=0.0, name="slat")
    mw, md = W - 2 * p - 0.02, D - 2 * p - 0.02
    m.box((mw, 0.1, md), (0, deck_y + 0.04 + 0.05, 0), side, bevel=0.02, seg=3, name="mattress_body")
    m.cushion((mw + 0.004, 0.05, md + 0.004), (0, deck_y + 0.135, 0), mat_top, puff=0.3, round_=0.45, cuts=5,
              name="mattress_top")
    # 転落防止柵: 奥(-X)は全長、手前(+X)ははしご位置を空ける
    ladder_z0, ladder_z1 = D / 2 - 0.55, D / 2 - p
    for y in (1.52, H - 0.02):
        m.box((0.025, 0.03, D - 2 * p), (-px, y, 0), metal, bevel=0.003, name="guard")
        m.box((0.025, 0.03, ladder_z0 - (-D / 2 + p)), (px, y, (ladder_z0 + (-D / 2 + p)) / 2), metal, bevel=0.003,
              name="guard")
        for sz in (-1, 1):
            m.box((W - 2 * p, 0.03, 0.025), (0, y, sz * pz), metal, bevel=0.003, name="guard_end")
    m.box((0.03, H - deck_y, 0.03), (px, (H + deck_y) / 2, ladder_z0), metal, bevel=0.003, name="guard_post")
    # はしご (+X側面、足元寄り)
    lz0, lz1 = ladder_z0 + 0.06, ladder_z1 - 0.08
    for z in (lz0, lz1):
        m.box((0.03, 1.55, 0.03), (px + 0.002, 1.55 / 2, z), metal, bevel=0.003, name="ladder_rail")
    for i in range(5):
        y = 0.27 + i * 0.26
        m.cyl(0.013, lz1 - lz0, (px + 0.002, y, (lz0 + lz1) / 2), metal, seg=10, axis="z", name="rung")
    return m


@asset("futon_floor.glb", (1.00, 0.08, 2.00))
def futon_floor(tint=None):
    m = Model("futon_floor")
    fab = m.mat("tint", tint or "#f1ece0", rough=0.95)
    m.cushion((1.00, 0.08, 2.00), (0, 0.04, 0), fab, puff=0.45, round_=0.45, cuts=8, name="futon")
    # 外周の縫い目
    seam = m.mat("seam", "#ddd5c4", rough=0.95)
    m.box((0.93, 0.004, 0.004), (0, 0.064, 0.962), seam, bevel=0.0, name="seam")
    m.box((0.93, 0.004, 0.004), (0, 0.064, -0.962), seam, bevel=0.0, name="seam")
    m.box((0.004, 0.004, 1.93), (0.462, 0.064, 0), seam, bevel=0.0, name="seam")
    m.box((0.004, 0.004, 1.93), (-0.462, 0.064, 0), seam, bevel=0.0, name="seam")
    return m
