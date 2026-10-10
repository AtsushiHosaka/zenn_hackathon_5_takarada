module InteriorLinks
  # 商品名からカテゴリと置き場所の枠を決める規則。家具検索の検索語の解釈に使う
  module ProductCategories
    RULES = [
    # Oshi-katsu and display goods come first: their names often also contain ラック/シェルフ/ミラー.
    [ "oshi_goods", "desk_top", /うちわ(?:スタンド|立て|ホルダー)|団扇立て|アクスタ(?:スタンド|台座|ステージ)|アクリルスタンド(?:用)?\s?(?:台座|ステージ|ひな壇)|ひな壇/ ],
    [ "oshi_goods", "wall_decor", /壁掛け.*缶バッジ|缶バッジ.*壁掛け/ ],
    [ "oshi_goods", "desk_top", /缶バッジ\s?(?:ディスプレイ|ホルダー|ボード|スタンド)|バッジディスプレイ/ ],
    [ "acrylic_stand_case", "desk_top", /アクスタ(?:ケース|ボックス)|アクリルスタンド(?:用)?ケース|アクリル(?:コレクション|ディスプレイ)(?:ケース|スタンド)/ ],
    [ "display_case", "display", /(?:コレクション|ディスプレイ|フィギュア)(?:ケース|ラック|キャビネット)|ガラス(?:キャビネット|ケース)/ ],
    [ "tapestry", "wall_decor", /タペストリー/ ], [ "neon", "wall_decor", /ネオン(?:サイン|ライト|管)/ ],
    [ "wall_shelf", "wall_decor", /ウォール\s?(?:シェルフ|ラック)|壁(?:掛け|付け)(?:棚|ラック|シェルフ)/ ],
    [ "bed_cover", "bed_cover", /掛け?布団カバー|掛ふとんカバー|ベッドカバー|掛けふとんカバー/ ],
    [ "curtain", "curtain", /カーテン/ ], [ "rug", "rug", /ラグ|カーペット|じゅうたん/ ],
    [ "cushion", "cushion", /クッション/ ], [ "floor_lamp", "light", /フロアランプ|フロアライト|スタンドライト/ ],
    [ "desk_lamp", "desk_top", /デスクライト|テーブルランプ|卓上ライト|クリップライト/ ],
    [ "candle", "desk_top", /キャンドル(?!ホルダー|スタンド)/ ],
    [ "wall_mirror", "wall_decor", /ミラー|鏡/ ],
    [ "wall_art", "wall_decor", /ポスター|アートパネル|フォトフレーム|写真立て|額縁/ ],
    [ "wall_planter", "wall_decor", /つり下げ型|ハンギング|壁掛け.*グリーン/ ],
    [ "plant", "display", /観葉植物|フェイクグリーン|人工植物/ ],
    [ "vase", "display", /花瓶|フラワーベース|一輪挿し|ドライフラワー/ ],
    [ "sofa", "floor", /ソファ|ソファー/ ], [ "bed", "floor", /ベッドフレーム|ベッド(?!カバー|サイド)/ ],
    [ "desk", "floor", /デスク|机/ ], [ "chair", "floor", /チェア|椅子|スツール/ ],
    [ "tv_stand", "floor", /テレビ(?:台|ボード|スタンド)|TV(?:台|ボード)|テレビキャビネット/i ],
    [ "wardrobe", "floor", /ワードローブ|衣装棚|洋服(?:ダンス|箪笥)|クローゼット/ ],
    [ "storage", "floor", /収納家具|収納ボックス|収納ケース|チェスト|サイドボード/ ],
    [ "shelf", "floor", /シェルフ|本棚|(?<!ブ)ラック|キャビネット|チェスト|書棚/ ],
    [ "table", "floor", /テーブル/ ]
  ].freeze
  end
end
