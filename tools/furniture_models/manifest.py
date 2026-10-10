"""GLB実測値とbuild_report.jsonからDB登録用カタログを作る。通常のPythonで実行。"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent

CATEGORY = {
    "sofa": "sofa", "bed_cover": "bed_cover", "bed": "bed", "futon": "bed", "table_low": "table",
    "table_dining": "table", "side_table": "side_table", "desk_lamp": "desk_lamp", "desk": "desk",
    "chair": "chair", "stool": "chair", "bookshelf": "shelf", "shelf": "shelf", "wardrobe": "storage",
    "chest": "storage", "tv_stand": "storage", "wall_shelf": "wall_shelf", "display_case": "display_case",
    "display_rack": "display_case", "display_stand": "display_stand", "acrylic": "acrylic_stand_case",
    "curtain": "curtain", "rug": "rug", "cushion": "cushion", "tapestry": "tapestry", "floor_lamp": "floor_lamp",
    "led": "led", "candle": "candle", "plant": "plant", "small_plant": "small_plant",
    "wall_planter": "wall_planter", "wall_mirror": "wall_mirror", "wall_art": "wall_art", "monitor": "monitor",
    # 2026-10-04 追加分
    "ottoman": "ottoman", "bench": "bench", "beanbag": "beanbag", "floor_chair": "chair", "kotatsu": "table",
    "nightstand": "side_table", "console_table": "table", "wagon": "storage", "hanger_rack": "storage",
    "ladder_shelf": "shelf", "storage_basket": "storage_box", "pegboard": "pegboard", "dresser": "dresser",
    "mirror_stand": "floor_mirror", "mirror_arch": "wall_mirror", "table_lamp": "table_lamp",
    "pendant_light": "pendant_light", "tv": "tv", "plant_stand": "plant_stand", "vase": "vase",
    "wall_clock": "wall_clock", "photo_frame": "photo_frame", "plush": "plush", "blanket": "blanket",
    "room_divider": "room_divider", "trash_bin": "trash_bin",
    # IKEAのカテゴリ網羅分 (モデル名の完全一致)
    "shelf_metal": "shelf", "shelf_cube_4x4": "shelf", "shelf_cube_boxes": "shelf",
    "chest_tall": "storage", "oshiire_case": "storage", "sideboard": "storage",
    "cabinet_glass": "display_case", "cupboard": "storage", "tv_stand_wide": "storage",
    "shoe_rack": "storage", "shoe_cabinet": "storage", "file_wagon": "storage",
    "wall_hooks": "wall_hooks", "storage_box_fabric": "storage_box", "armchair_wing": "chair",
    "chaise_longue": "sofa", "rocking_chair": "chair", "sofa_bed": "sofa",
    "sofa_modular": "sofa", "chair_folding": "chair", "chair_shell": "chair",
    "stool_bar": "chair", "table_bar": "table", "table_cafe": "table",
    "step_stool": "chair", "kids_table": "table", "kids_chair": "chair",
    "high_chair": "chair", "desk_standing": "desk", "chair_gaming": "chair",
    "laptop": "laptop", "bed_storage": "bed", "bed_bunk": "bed",
    "headboard": "headboard", "bed_slatted": "bed", "mattress_floor": "bed",
    "duvet_set": "bedding", "pillow": "bedding", "seat_cushion": "cushion",
    "rug_runner": "rug", "blind_roller": "blind", "ceiling_light": "ceiling_light",
    "floor_lamp_arc": "floor_lamp", "desk_lamp_arm": "desk_lamp", "lamp_lantern": "table_lamp",
    "fairy_lights": "led", "air_purifier": "appliance", "speaker": "appliance",
    "fan": "appliance", "humidifier": "appliance", "vacuum_stick": "appliance",
    "fridge": "appliance", "microwave": "appliance", "range_rack": "storage",
    "plant_snake": "plant", "plant_cactus": "small_plant", "plant_pothos_hanging": "plant",
    "watering_can": "goods", "figurine": "decor", "reed_diffuser": "decor",
    "poster": "wall_art", "photo_wall": "wall_art", "memo_board": "memo_board",
    "books_row": "books", "books_stack": "books", "tableware_set": "tableware",
    "laundry_basket": "laundry", "drying_rack": "laundry", "cat_tower": "pet",
    "pet_bed": "pet", "balcony_set": "outdoor",
    # 2026-10-05 バリエーション追加分
    "shelf_corner": "shelf", "shelf_gap": "storage", "wardrobe_open": "storage",
    "chest_low": "storage", "magazine_rack": "storage", "coat_stand": "storage",
    "umbrella_stand": "storage", "shelf_floating": "wall_shelf", "storage_bench": "bench",
    "toy_storage": "storage", "kitchen_counter": "storage", "mirror_cabinet": "floor_mirror",
    "shoji_screen": "room_divider", "desk_shelf": "shelf", "sofa_wood_frame": "sofa",
    "sofa_chesterfield": "sofa", "sofa_cloud": "sofa", "chair_wishbone": "chair",
    "chair_windsor": "chair", "chair_rattan": "chair", "pouf_square": "ottoman",
    "bench_upholstered": "bench", "table_low_oval": "table", "table_nesting": "side_table",
    "table_dining_6": "table", "table_folding_low": "table", "table_glass_low": "table",
    "dining_set_2": "dining_set", "bed_headboard_double": "bed", "bed_canopy": "bed",
    "daybed": "bed", "bed_kids": "bed", "futon_set": "bedding",
    "crib": "bed", "rug_checker": "rug", "rug_oval": "rug",
    "curtain_tieback": "curtain", "cushion_round": "cushion", "body_pillow": "bedding",
    "vanity_stool": "chair", "slippers": "goods", "rice_cooker": "appliance",
    "kettle": "appliance", "toaster": "appliance", "coffee_maker": "appliance",
    "washing_machine": "appliance", "dish_rack": "kitchen", "heater": "appliance",
    "desktop_pc": "appliance", "keyboard_mouse": "appliance", "projector": "appliance",
    "radio": "appliance", "lamp_paper": "floor_lamp", "lamp_wall": "wall_light",
    "neon_sign": "neon", "plant_pachira": "plant", "plant_dracaena": "plant",
    "plant_succulents": "small_plant", "dried_flowers": "vase", "terrarium": "small_plant",
    "aquarium": "aquarium", "plush_bunny": "plush", "acrylic_stand": "oshi_goods", "acrylic_stand_case": "acrylic_stand_case",
    "badge_display": "oshi_goods", "uchiwa_stand": "oshi_goods", "photo_garland": "wall_art",
    "wall_shelf_hex": "wall_shelf", "record_player": "appliance", "guitar": "hobby",
    "suitcase": "goods", "yoga_mat": "goods",
    # 2026-10-10 推し活グッズ (完全一致)
    "acrylic_stand_s": "oshi_goods",
    "acrylic_stand_m": "oshi_goods",
    "acrylic_stand_l": "oshi_goods",
    "acrylic_stand_big": "oshi_goods",
    "tapestry_b2": "tapestry",
    "tapestry_b1": "tapestry",
    "plush_base_s": "plush",
    "plush_base_m": "plush",
    "plush_base_l": "plush",
    "cushion_diecut": "cushion",
    "can_badge": "oshi_goods",
    "rubber_mat": "oshi_goods",
    "blanket_print": "blanket",
    "acrylic_panel": "oshi_goods",
    "char_hatsune_miku_plush": "plush",
    "char_hatsune_miku_plush_big": "plush",
    "char_hatsune_miku_acrylic_stand": "oshi_goods",
    "char_hatsune_miku_tapestry_b2": "tapestry",
    "char_hatsune_miku_cushion": "cushion",
    "char_hatsune_miku_figure": "oshi_goods",
    # 2026-10-10 初音ミクのグッズ追加分 (完全一致)
    "char_hatsune_miku_cushion_round": "cushion",
    "char_hatsune_miku_cushion_square": "cushion",
    "char_hatsune_miku_cushion_body": "cushion",
    "char_hatsune_miku_pc_cushion": "cushion",
    "char_hatsune_miku_dakimakura": "bedding",
    "char_hatsune_miku_blanket": "blanket",
    "char_hatsune_miku_plush_lying": "plush",
    "char_hatsune_miku_plush_negi": "plush",
    "char_hatsune_miku_bed_cover": "bed_cover",
    "char_hatsune_miku_rug": "rug",
    "char_hatsune_miku_seat_cushion": "cushion",
    "char_hatsune_miku_poster_a3": "wall_art",
    "char_hatsune_miku_tapestry_life": "tapestry",
    "char_hatsune_miku_standee": "oshi_goods",
    "char_hatsune_miku_wall_clock": "wall_clock",
    "char_hatsune_miku_mug": "tableware",
    "char_hatsune_miku_diorama": "oshi_goods",
    "char_hatsune_miku_desk_mat": "oshi_goods",
    "char_hatsune_miku_penlight": "oshi_goods",
    "char_hatsune_miku_can_badge": "oshi_goods",
    "char_hatsune_miku_uchiwa": "oshi_goods",
    "char_hatsune_miku_led_light": "desk_lamp",
}
NAMES = {
    "sofa_1seat": "1人掛けソファ", "sofa_2seat": "2人掛けソファ", "sofa_3seat": "3人掛けソファ",
    "sofa_low": "ローソファ", "sofa_l_left": "L字ソファ（正面から見て左カウチ）",
    "sofa_l_right": "L字ソファ（正面から見て右カウチ）", "sofa_bed_open": "展開したソファベッド",
    "bed_single": "シングルベッド", "bed_semidouble": "セミダブルベッド", "bed_double": "ダブルベッド",
    "bed_loft": "ロフトベッド", "futon_floor": "床敷き布団", "bed_cover": "ベッドカバー",
    "table_low_rect": "長方形ローテーブル", "table_low_round": "円形ローテーブル",
    "table_dining_rect": "長方形ダイニングテーブル", "table_dining_round": "円形ダイニングテーブル",
    "desk_wood": "木製デスク", "desk_wide": "ワイドデスク", "desk_l_left": "L字デスク（正面から見て左）",
    "desk_fold": "折り畳みデスク（使用状態）", "side_table": "円形サイドテーブル",
    "bookshelf": "本棚", "shelf_low": "低いオープン棚", "shelf_cube": "キューブ収納",
    "wardrobe": "ワードローブ", "chest_drawers": "チェスト", "tv_stand": "テレビ台",
    "chair_dining": "木製ダイニングチェア", "chair_office": "デスクチェア", "stool_round": "円形スツール",
    "curtain_pair": "両開きカーテン", "curtain_sheer": "レースカーテン", "rug_rect": "長方形ラグ",
    "rug_round": "円形ラグ", "rug_wave": "ウェーブラグ", "cushion": "クッション", "tapestry": "タペストリー",
    "wall_shelf": "壁付け3段棚", "display_case": "コレクションケース", "acrylic_stand_case": "卓上ひな壇",
    "display_rack_open": "オープンディスプレイラック", "display_stand_floor": "床置き3段ディスプレイ棚",
    "floor_lamp": "シェード付きフロアライト", "floor_lamp_slim": "スリムフロアライト",
    "floor_lamp_rattan": "ラタン調フロアライト", "floor_lamp_tripod": "三脚フロアライト",
    "floor_lamp_ball": "ボール型フロアライト", "floor_lamp_pleated": "プリーツシェードフロアライト",
    "desk_lamp_clip": "クリップライト", "led_strip_segment": "直線LEDテープ", "candle": "キャンドル",
    "plant_monstera": "モンステラ", "plant_eucalyptus": "ユーカリ", "small_plant": "卓上ミニ植物",
    "wall_planter": "壁掛けグリーン", "wall_mirror": "ウェーブミラー", "wall_art": "額入りアート",
    "monitor": "デスク上モニター",
    "ottoman_round": "丸型オットマン", "bench_wood": "木製ベンチ", "chair_lounge": "ラウンジチェア",
    "beanbag": "ビーズクッション", "floor_chair": "座椅子", "kotatsu": "こたつ（掛け布団付き）",
    "nightstand": "ナイトテーブル", "console_table": "コンソールテーブル", "side_table_c": "コの字サイドテーブル",
    "wagon_cart": "3段ワゴン", "hanger_rack": "ハンガーラック", "ladder_shelf": "ラダーシェルフ",
    "storage_basket": "ラタン調収納バスケット", "pegboard": "有孔ボード", "dresser": "ミラー付きドレッサー",
    "mirror_stand": "スタンドミラー", "mirror_arch": "アーチ型ウォールミラー",
    "table_lamp": "マッシュルーム型テーブルランプ", "pendant_light": "ペンダントライト", "tv": "43型テレビ",
    "plant_fiddle": "ウンベラータ", "plant_olive": "オリーブの木", "plant_stand": "2段フラワースタンド",
    "vase_tulip": "花瓶とチューリップ", "wall_clock": "壁掛け時計", "photo_frame": "卓上フォトフレーム",
    "plush_bear": "くまのぬいぐるみ", "blanket_folded": "たたんだブランケット",
    "room_divider": "3連パーテーション", "trash_bin": "ゴミ箱",
    "shelf_metal": "メタルラック", "shelf_cube_4x4": "キューブ収納4×4", "shelf_cube_boxes": "収納ボックス入りキューブ収納",
    "chest_tall": "縦長チェスト6段", "oshiire_case": "押し入れ衣装ケース（3段積み）", "sideboard": "サイドボード",
    "cabinet_glass": "ガラス扉キャビネット", "cupboard": "食器棚", "tv_stand_wide": "ロータイプテレビ台",
    "shoe_rack": "靴ラック", "shoe_cabinet": "下駄箱", "file_wagon": "デスク下ワゴン",
    "wall_hooks": "フックラック", "storage_box_fabric": "布製収納ボックス", "armchair_wing": "ウイングチェア",
    "chaise_longue": "寝椅子（シェーズロング）", "rocking_chair": "ロッキングチェア", "sofa_bed": "ソファベッド（ソファ状態）",
    "sofa_modular": "モジュールソファ（コーナー）", "chair_folding": "折り畳みチェア", "chair_shell": "シェルチェア",
    "stool_bar": "カウンタースツール", "table_bar": "カウンターテーブル", "table_cafe": "カフェテーブル",
    "step_stool": "ステップスツール（踏み台）", "kids_table": "キッズテーブル", "kids_chair": "キッズチェア",
    "high_chair": "ベビーハイチェア", "desk_standing": "昇降デスク", "chair_gaming": "ゲーミングチェア",
    "laptop": "ノートPC（開いた状態）", "bed_storage": "収納付きベッド", "bed_bunk": "2段ベッド",
    "headboard": "棚付きヘッドボード", "bed_slatted": "すのこベッド（低床）", "mattress_floor": "床置きマットレス",
    "duvet_set": "掛け布団と枕", "pillow": "枕", "seat_cushion": "シートクッション（座布団）",
    "rug_runner": "ランナーラグ", "blind_roller": "ロールスクリーン", "ceiling_light": "シーリングライト",
    "floor_lamp_arc": "アーチ型フロアランプ", "desk_lamp_arm": "アーム式デスクライト", "lamp_lantern": "ランタン型ライト",
    "fairy_lights": "ガーランドライト", "air_purifier": "空気清浄機", "speaker": "スピーカー",
    "fan": "扇風機", "humidifier": "加湿器", "vacuum_stick": "スティック掃除機（スタンド付き）",
    "fridge": "2ドア冷蔵庫", "microwave": "電子レンジ", "range_rack": "レンジ台",
    "plant_snake": "サンセベリア", "plant_cactus": "サボテン", "plant_pothos_hanging": "吊り下げポトス",
    "watering_can": "じょうろ", "figurine": "オブジェ", "reed_diffuser": "リードディフューザー",
    "poster": "ポスター（フレーム入り）", "photo_wall": "フォトフレーム3枚組", "memo_board": "メモボード",
    "books_row": "本の列（ブックエンド付き）", "books_stack": "積んだ本", "tableware_set": "マグとトレー",
    "laundry_basket": "ランドリーバスケット", "drying_rack": "物干しラック", "cat_tower": "キャットタワー",
    "pet_bed": "ペットベッド", "balcony_set": "バルコニー用テーブルとチェア2脚",
    "shelf_corner": "コーナーラック", "shelf_gap": "すき間収納ワゴン", "wardrobe_open": "オープンクローゼット",
    "chest_low": "ローチェスト", "magazine_rack": "マガジンラック", "coat_stand": "コートハンガースタンド",
    "umbrella_stand": "傘立て", "shelf_floating": "ウォールシェルフ（1枚）", "storage_bench": "収納ベンチ",
    "toy_storage": "おもちゃ収納ラック", "kitchen_counter": "キッチンカウンター（間仕切り収納）", "mirror_cabinet": "ミラー付き収納",
    "shoji_screen": "障子風パーテーション", "desk_shelf": "机上ラック", "sofa_wood_frame": "木枠ソファ",
    "sofa_chesterfield": "チェスターフィールドソファ", "sofa_cloud": "もこもこソファ（クラウドソファ）", "chair_wishbone": "Yチェア風チェア",
    "chair_windsor": "ウィンザーチェア", "chair_rattan": "ラタンチェア", "pouf_square": "キューブ型スツール",
    "bench_upholstered": "布張りベンチ", "table_low_oval": "楕円ローテーブル", "table_nesting": "ネストテーブル（2点）",
    "table_dining_6": "6人掛けダイニングテーブル", "table_folding_low": "折り畳みローテーブル", "table_glass_low": "ガラスローテーブル",
    "dining_set_2": "2人用ダイニングセット", "bed_headboard_double": "ヘッドボード付きダブルベッド", "bed_canopy": "天蓋付きベッド",
    "daybed": "デイベッド", "bed_kids": "キッズベッド", "futon_set": "布団一式（敷布団・掛け布団・枕）",
    "crib": "ベビーベッド", "rug_checker": "チェック柄ラグ", "rug_oval": "楕円ラグ",
    "curtain_tieback": "タッセル付きカーテン（まとめた状態）", "cushion_round": "丸クッション", "body_pillow": "抱き枕",
    "vanity_stool": "ドレッサースツール", "slippers": "スリッパ", "rice_cooker": "炊飯器",
    "kettle": "電気ケトル", "toaster": "オーブントースター", "coffee_maker": "コーヒーメーカー",
    "washing_machine": "縦型洗濯機", "dish_rack": "水切りラック", "heater": "オイルヒーター",
    "desktop_pc": "デスクトップPC", "keyboard_mouse": "キーボードとマウス", "projector": "プロジェクター",
    "radio": "レトロラジオ", "lamp_paper": "和紙フロアランプ", "lamp_wall": "ブラケットライト",
    "neon_sign": "ネオンサイン（ハート）", "plant_pachira": "パキラ", "plant_dracaena": "ドラセナ",
    "plant_succulents": "多肉植物の寄せ植え", "dried_flowers": "ドライフラワー（花瓶）", "terrarium": "テラリウム",
    "aquarium": "水槽", "plush_bunny": "うさぎのぬいぐるみ", "acrylic_stand": "アクリルスタンド",
    "badge_display": "缶バッジディスプレイ", "uchiwa_stand": "うちわ（スタンド付き）", "photo_garland": "フォトガーランド",
    "wall_shelf_hex": "六角形ウォールシェルフ", "record_player": "レコードプレーヤー", "guitar": "ギター（スタンド付き）",
    "suitcase": "スーツケース", "yoga_mat": "ヨガマット（丸めた状態）",
    "acrylic_stand_s": "アクリルスタンド S",
    "acrylic_stand_m": "アクリルスタンド M",
    "acrylic_stand_l": "アクリルスタンド L",
    "acrylic_stand_big": "BIGアクリルスタンド",
    "tapestry_b2": "B2タペストリー",
    "tapestry_b1": "B1タペストリー",
    "plush_base_s": "ぬいぐるみ素体 S",
    "plush_base_m": "ぬいぐるみ素体 M",
    "plush_base_l": "ぬいぐるみ素体 L",
    "cushion_diecut": "ダイカットクッション",
    "can_badge": "缶バッジ（イーゼル付き）",
    "rubber_mat": "ラバーマット",
    "blanket_print": "プリントブランケット",
    "acrylic_panel": "アクリルパネル",
    "char_hatsune_miku_plush": "初音ミク ぬいぐるみ",
    "char_hatsune_miku_plush_big": "初音ミク BIGぬいぐるみ",
    "char_hatsune_miku_acrylic_stand": "初音ミク アクリルスタンド",
    "char_hatsune_miku_tapestry_b2": "初音ミク B2タペストリー",
    "char_hatsune_miku_cushion": "初音ミク ダイカットクッション",
    "char_hatsune_miku_figure": "初音ミク ミニフィギュア",
    "char_hatsune_miku_cushion_round": "初音ミク 丸クッション",
    "char_hatsune_miku_cushion_square": "初音ミク スクエアクッション",
    "char_hatsune_miku_cushion_body": "初音ミク 全身ダイカットクッション",
    "char_hatsune_miku_pc_cushion": "初音ミク PCクッション",
    "char_hatsune_miku_dakimakura": "初音ミク 抱き枕",
    "char_hatsune_miku_blanket": "初音ミク ブランケット",
    "char_hatsune_miku_plush_lying": "初音ミク 寝そべりぬいぐるみ",
    "char_hatsune_miku_plush_negi": "初音ミク ネギ持ちぬいぐるみ",
    "char_hatsune_miku_bed_cover": "初音ミク 布団カバー",
    "char_hatsune_miku_rug": "初音ミク ラグ",
    "char_hatsune_miku_seat_cushion": "初音ミク 座布団",
    "char_hatsune_miku_poster_a3": "初音ミク A3ポスター（額装）",
    "char_hatsune_miku_tapestry_life": "初音ミク 等身大タペストリー",
    "char_hatsune_miku_standee": "初音ミク 等身大パネル",
    "char_hatsune_miku_wall_clock": "初音ミク 壁掛け時計",
    "char_hatsune_miku_mug": "初音ミク マグカップ",
    "char_hatsune_miku_diorama": "初音ミク アクリルジオラマ",
    "char_hatsune_miku_desk_mat": "初音ミク デスクマット",
    "char_hatsune_miku_penlight": "初音ミク ペンライト（スタンド付き）",
    "char_hatsune_miku_can_badge": "初音ミク 缶バッジ",
    "char_hatsune_miku_uchiwa": "初音ミク うちわ（スタンド付き）",
    "char_hatsune_miku_led_light": "初音ミク LEDアクリルライト",
}
# 推し活グッズのモデル形状 → (グッズ種別, キャラクター)。グッズ種別は家具の category になる。
# キャラクターは backend/db/characters.json の characters[].key。未登録の形状は家具として扱う。
GOODS = {
    "acrylic_stand": ("acrylic_stand", []),
    "tapestry": ("tapestry", []),
    "uchiwa_stand": ("uchiwa", []),
    "badge_display": ("can_badge", []),
    "poster": ("poster", []),
    "plush_bear": ("plush", []),
    "plush_bunny": ("plush", []),
    "cushion": ("cushion", []),
    "cushion_round": ("cushion", []),
    # 2026-10-10 グッズのテンプレートと初音ミク
    "acrylic_stand_s": ("acrylic_stand", []),
    "acrylic_stand_m": ("acrylic_stand", []),
    "acrylic_stand_l": ("acrylic_stand", []),
    "acrylic_stand_big": ("acrylic_stand", []),
    "tapestry_b2": ("tapestry", []),
    "tapestry_b1": ("tapestry", []),
    "plush_base_s": ("plush", []),
    "plush_base_m": ("plush", []),
    "plush_base_l": ("plush", []),
    "cushion_diecut": ("cushion", []),
    "can_badge": ("can_badge", []),
    "rubber_mat": ("rubber_mat", []),
    "blanket_print": ("blanket", []),
    "acrylic_panel": ("acrylic_panel", []),
    "char_hatsune_miku_plush": ("plush", ["hatsune_miku"]),
    "char_hatsune_miku_plush_big": ("plush", ["hatsune_miku"]),
    "char_hatsune_miku_acrylic_stand": ("acrylic_stand", ["hatsune_miku"]),
    "char_hatsune_miku_tapestry_b2": ("tapestry", ["hatsune_miku"]),
    "char_hatsune_miku_cushion": ("cushion", ["hatsune_miku"]),
    "char_hatsune_miku_figure": ("figure", ["hatsune_miku"]),
    # 2026-10-10 初音ミクのグッズ追加分
    "char_hatsune_miku_cushion_round": ("cushion", ["hatsune_miku"]),
    "char_hatsune_miku_cushion_square": ("cushion", ["hatsune_miku"]),
    "char_hatsune_miku_cushion_body": ("cushion", ["hatsune_miku"]),
    "char_hatsune_miku_pc_cushion": ("cushion", ["hatsune_miku"]),
    "char_hatsune_miku_dakimakura": ("body_pillow", ["hatsune_miku"]),
    "char_hatsune_miku_blanket": ("blanket", ["hatsune_miku"]),
    "char_hatsune_miku_plush_lying": ("plush", ["hatsune_miku"]),
    "char_hatsune_miku_plush_negi": ("plush", ["hatsune_miku"]),
    "char_hatsune_miku_bed_cover": ("bed_cover", ["hatsune_miku"]),
    "char_hatsune_miku_rug": ("rug", ["hatsune_miku"]),
    "char_hatsune_miku_seat_cushion": ("cushion", ["hatsune_miku"]),
    "char_hatsune_miku_poster_a3": ("poster", ["hatsune_miku"]),
    "char_hatsune_miku_tapestry_life": ("tapestry", ["hatsune_miku"]),
    "char_hatsune_miku_standee": ("standee", ["hatsune_miku"]),
    "char_hatsune_miku_wall_clock": ("wall_clock", ["hatsune_miku"]),
    "char_hatsune_miku_mug": ("mug", ["hatsune_miku"]),
    "char_hatsune_miku_diorama": ("acrylic_diorama", ["hatsune_miku"]),
    "char_hatsune_miku_desk_mat": ("rubber_mat", ["hatsune_miku"]),
    "char_hatsune_miku_penlight": ("penlight", ["hatsune_miku"]),
    "char_hatsune_miku_can_badge": ("can_badge", ["hatsune_miku"]),
    "char_hatsune_miku_uchiwa": ("uchiwa", ["hatsune_miku"]),
    "char_hatsune_miku_led_light": ("room_light", ["hatsune_miku"]),
}
NOT_GOODS = (None, [])


def category(name):
    for prefix in sorted(CATEGORY, key=len, reverse=True):
        if name.startswith(prefix):
            return CATEGORY[prefix]
    raise KeyError(name)


def goods(shape):
    _, characters = GOODS.get(shape, NOT_GOODS)
    return {"characters": list(characters)}


IDENTITY = [[1 if row == col else 0 for col in range(4)] for row in range(4)]


def multiply(left, right):
    return [[sum(left[row][i] * right[i][col] for i in range(4)) for col in range(4)] for row in range(4)]


def transform(node):
    if "matrix" in node:
        return [[node["matrix"][col * 4 + row] for col in range(4)] for row in range(4)]
    x, y, z, w = node.get("rotation", [0, 0, 0, 1])
    scale = node.get("scale", [1, 1, 1])
    translation = node.get("translation", [0, 0, 0])
    matrix = [
        [1 - 2 * (y*y + z*z), 2 * (x*y - z*w), 2 * (x*z + y*w)],
        [2 * (x*y + z*w), 1 - 2 * (x*x + z*z), 2 * (y*z - x*w)],
        [2 * (x*z - y*w), 2 * (y*z + x*w), 1 - 2 * (x*x + y*y)],
    ]
    return [[matrix[row][col] * scale[col] for col in range(3)] + [translation[row]] for row in range(3)] + [[0, 0, 0, 1]]


def measure_glb(path):
    """頂点とsceneの変換から、書き出し後の幅・高さ・奥行きを測る。"""
    data = path.read_bytes()
    if len(data) < 20 or struct.unpack_from("<4sII", data) != (b"glTF", 2, len(data)):
        raise ValueError(f"Invalid GLB header: {path}")
    chunks = {}
    offset = 12
    while offset < len(data):
        length, kind = struct.unpack_from("<I4s", data, offset)
        offset += 8
        if length % 4 or offset + length > len(data) or kind in chunks:
            raise ValueError(f"Invalid GLB chunk: {path}")
        chunks[kind] = data[offset:offset + length]
        offset += length
    doc = json.loads(chunks[b"JSON"])
    binary = chunks[b"BIN\x00"]
    if doc["asset"]["version"] != "2.0" or len(doc.get("buffers", [])) != 1:
        raise ValueError(f"Expected self-contained glTF 2.0: {path}")
    if doc["buffers"][0].get("uri") or any(image.get("uri") for image in doc.get("images", [])):
        raise ValueError(f"External resources must be embedded: {path}")
    if doc.get("skins") or doc.get("animations"):
        raise ValueError(f"Expected a static furniture model: {path}")

    minimum, maximum = [math.inf] * 3, [-math.inf] * 3
    triangles = 0

    def visit(index, parent, ancestors):
        nonlocal triangles
        if index in ancestors:
            raise ValueError(f"Cyclic scene graph: {path}")
        node = doc["nodes"][index]
        world = multiply(parent, transform(node))
        if "mesh" in node:
            for primitive in doc["meshes"][node["mesh"]]["primitives"]:
                accessor = doc["accessors"][primitive["attributes"]["POSITION"]]
                if accessor["componentType"] != 5126 or accessor["type"] != "VEC3" or "sparse" in accessor:
                    raise ValueError(f"Expected float VEC3 positions: {path}")
                view = doc["bufferViews"][accessor["bufferView"]]
                if view.get("buffer", 0) != 0:
                    raise ValueError(f"Expected embedded positions: {path}")
                start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
                stride = view.get("byteStride", 12)
                for i in range(accessor["count"]):
                    vertex = (*struct.unpack_from("<fff", binary, start + i * stride), 1)
                    for axis in range(3):
                        value = sum(world[axis][col] * vertex[col] for col in range(4))
                        if not math.isfinite(value):
                            raise ValueError(f"Non-finite position: {path}")
                        minimum[axis] = min(minimum[axis], value)
                        maximum[axis] = max(maximum[axis], value)
                if primitive.get("mode", 4) != 4:
                    raise ValueError(f"Expected triangle meshes: {path}")
                count = doc["accessors"][primitive["indices"]]["count"] if "indices" in primitive else accessor["count"]
                if count % 3:
                    raise ValueError(f"Incomplete triangle mesh: {path}")
                triangles += count // 3
        for child in node.get("children", []):
            visit(child, world, ancestors | {index})

    for root in doc["scenes"][doc.get("scene", 0)]["nodes"]:
        visit(root, IDENTITY, set())
    size = [maximum[i] - minimum[i] for i in range(3)]
    if not all(math.isfinite(value) and value > 0 for value in size):
        raise ValueError(f"Expected positive dimensions: {path}")
    origin = [(minimum[0] + maximum[0]) / 2, minimum[1], (minimum[2] + maximum[2]) / 2]
    if any(abs(value) > 0.00001 for value in origin):
        raise ValueError(f"Expected bottom-center origin: {path}: {origin}")
    return {"size": [round(value, 6) for value in size], "triangles": triangles,
            "materials": [material["name"] for material in doc.get("materials", [])],
            "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--models-dir", type=Path, default=ROOT / "output/furniture_models/furniture")
    parser.add_argument("--report", type=Path, default=HERE / "build_report.json")
    parser.add_argument("--output", type=Path, default=ROOT / "backend/db/furnitures.json")
    args = parser.parse_args()
    report = json.loads(args.report.read_text())
    models = []
    ids = set()
    for item in sorted(report, key=lambda row: row["file"]):
        filename = item["file"]
        if Path(filename).name != filename or not filename.endswith(".glb"):
            raise ValueError(f"Invalid model filename: {filename}")
        model_id = filename[:-4]
        if model_id in ids:
            raise ValueError(f"Duplicate model id: {model_id}")
        ids.add(model_id)
        base, _, variant = model_id.partition("__")
        stats = measure_glb(args.models_dir / filename)
        if item.get("sha256") != stats["sha256"]:
            raise ValueError(f"Build report SHA256 differs from exported file: {filename}")
        target = item["target"]
        if len(target) != 3 or any(not math.isfinite(value) or value <= 0 for value in target):
            raise ValueError(f"Invalid target dimensions: {filename}")
        if any(abs(actual - expected) > 0.00001 for actual, expected in zip(stats["size"], target)):
            raise ValueError(f"Exported size differs from target: {filename}: {stats['size']} vs {target}")
        if stats["triangles"] != item["tris"] or stats["materials"] != item["materials"]:
            raise ValueError(f"Build report differs from exported geometry/materials: {filename}")
        models.append({"id": model_id, "name": NAMES[base], "category": GOODS.get(base, NOT_GOODS)[0] or category(base), "shape": base,
                       "variant": variant or None, "format": "glb", "object_key": f"models/furniture/v1/{filename}",
                       **{("color_material_keys" if key == "materials" else key): value for key, value in stats.items()},
                       **goods(base)})
    catalog = {"unit": "meter", "axes": "+Y up, +Z front, origin bottom center", "models": models}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(catalog, ensure_ascii=False, indent=1) + "\n")
    print(f"{len(models)} models -> {args.output}")


if __name__ == "__main__":
    main()
