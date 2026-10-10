require "nokogiri"
require "bigdecimal"
require "digest"
require "cgi"

module InteriorLinks
  # Prices remain verified. Missing dimensions may use explicit category estimates.
  class ProductParser
    CATEGORY_RULES = [
      # Oshi-katsu and display goods come first: their names often also contain ラック/シェルフ/ミラー.
      [ "oshi_goods", "desk_top", /うちわ(?:スタンド|立て|ホルダー)|団扇立て|アクスタ(?:スタンド|台座|ステージ)|アクリルスタンド(?:用)?\s?(?:台座|ステージ|ひな壇)|ひな壇/ ],
      [ "oshi_goods", "wall_decor", /壁掛け.*缶バッジ|缶バッジ.*壁掛け/ ],
      [ "oshi_goods", "desk_top", /缶バッジ\s?(?:ディスプレイ|ホルダー|ボード|スタンド)|バッジディスプレイ/ ],
      [ "acrylic_stand_case", "desk_top", /アクスタ(?:ケース|ボックス)|アクリルスタンド(?:用)?ケース|アクリル(?:コレクション|ディスプレイ)(?:ケース|スタンド)/ ],
      [ "display_case", "display", /(?:コレクション|ディスプレイ|フィギュア)(?:ケース|ラック|キャビネット)|ガラス(?:キャビネット|ケース)/ ],
      # Character goods themselves (specs/character-goods/spec.md); stands and cases for them match above.
      [ "oshi_goods", "desk_top", /アクリル(?:スタンド|フィギュア|パネル|ブロック)|アクスタ|缶バッジ|ラバーマット|プレイマット|デスクマット|うちわ|団扇|フィギュア|ペンライト|等身大パネル|アクリルジオラマ|ジオラマスタンド/ ],
      [ "plush", "display", /ぬいぐるみ|ヌイグルミ|寝そべり|ふわぷち/ ], [ "blanket", "cushion", /ブランケット|ひざ掛け|膝掛け/ ],
      [ "tapestry", "wall_decor", /タペストリー/ ], [ "neon", "wall_decor", /ネオン(?:サイン|ライト|管)/ ],
      [ "wall_shelf", "wall_decor", /ウォール\s?(?:シェルフ|ラック)|壁(?:掛け|付け)(?:棚|ラック|シェルフ)/ ],
      [ "bed_cover", "bed_cover", /掛け?布団カバー|掛ふとんカバー|ベッドカバー|掛けふとんカバー/ ],
      [ "curtain", "curtain", /カーテン/ ], [ "rug", "rug", /ラグ|カーペット|じゅうたん/ ],
      [ "cushion", "cushion", /クッション|抱き枕/ ], [ "floor_lamp", "light", /フロアランプ|フロアライト|スタンドライト/ ],
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
    # Carried or worn "アクスタケース" (pouches, binders, phone cases) are not room display items.
    PORTABLE_GOODS = /ポーチ|持ち運び|バインダー|リフィル|スマホケース|iPhone|ペンケース|筆箱|筆入れ|バッグ|痛バ/
    # Worn or carried character goods (keychains, apparel, stationery) are not placed in a room either.
    WORN_GOODS = /キーホルダー|キーチェーン|キーリング|ストラップ|ボールチェーン|チャーム|スマホ|Tシャツ|パーカー|靴下|ソックス|帽子|キャップ|ネックレス|ピアス|イヤリング|ヘア(?:ゴム|クリップ|ピン)|ステッカー|シール|クリアファイル|ボールペン/i
    DISPLAY_GOODS = %w[oshi_goods acrylic_stand_case display_case].freeze
    CARRIED_CHECK_CATEGORIES = (DISPLAY_GOODS + %w[plush blanket]).freeze
    THIN_AXES = { "rug" => [ "h", 0.02 ], "bed_cover" => [ "h", 0.04 ],
                  "curtain" => [ "d", 0.04 ], "cushion" => [ "h", 0.15 ], "wall_art" => [ "d", 0.02 ],
                  "tapestry" => [ "d", 0.01 ], "neon" => [ "d", 0.03 ] }.freeze
    COLORS = { /ホワイト|白|アイボリー/ => "#f2efe8", /ブラック|黒/ => "#303030", /グリーン|緑/ => "#799469",
               /ブルー|青/ => "#778da6", /ピンク/ => "#d6a5b3", /グレー/ => "#aaa9a5", /ブラウン|茶|ウォールナット/ => "#987b61",
               /ナチュラル|ベージュ|無垢|オーク|アッシュ/ => "#c4ae8c", /パープル|紫/ => "#ad96bb" }.freeze
    ESTIMATED_SIZES = DEFAULT_SIZES.merge(
      "sofa" => { "w" => 1.8, "h" => 0.8, "d" => 0.85 }, "bed" => { "w" => 1.0, "h" => 0.8, "d" => 2.1 },
      "desk" => { "w" => 1.0, "h" => 0.73, "d" => 0.6 }, "chair" => { "w" => 0.5, "h" => 0.85, "d" => 0.5 },
      "tv_stand" => { "w" => 1.2, "h" => 0.45, "d" => 0.4 }, "wardrobe" => { "w" => 0.8, "h" => 1.8, "d" => 0.55 },
      "storage" => { "w" => 0.8, "h" => 0.8, "d" => 0.4 },
      "shelf" => { "w" => 0.8, "h" => 1.5, "d" => 0.35 }, "table" => { "w" => 0.8, "h" => 0.73, "d" => 0.6 },
      "desk_lamp" => { "w" => 0.25, "h" => 0.4, "d" => 0.25 }, "wall_mirror" => { "w" => 0.5, "h" => 0.7, "d" => 0.03 },
      "wall_art" => { "w" => 0.4, "h" => 0.5, "d" => 0.02 }, "wall_planter" => { "w" => 0.3, "h" => 0.4, "d" => 0.2 },
      "small_plant" => { "w" => 0.2, "h" => 0.3, "d" => 0.2 },
      # Matches the generic 3D models of the same category.
      "acrylic_stand_case" => { "w" => 0.3, "h" => 0.15, "d" => 0.15 }, "display_case" => { "w" => 0.4, "h" => 1.2, "d" => 0.3 },
      "oshi_goods" => { "w" => 0.25, "h" => 0.38, "d" => 0.1 }, "tapestry" => { "w" => 0.6, "h" => 0.9, "d" => 0.01 },
      "neon" => { "w" => 0.4, "h" => 0.35, "d" => 0.03 }, "wall_shelf" => { "w" => 0.6, "h" => 0.15, "d" => 0.15 },
      "vase" => { "w" => 0.15, "h" => 0.4, "d" => 0.15 }, "candle" => { "w" => 0.1, "h" => 0.12, "d" => 0.1 },
      "plush" => { "w" => 0.25, "h" => 0.3, "d" => 0.2 }, "blanket" => { "w" => 0.45, "h" => 0.12, "d" => 0.35 }
    ).freeze

    class Unverified < StandardError; end

    def initialize(user_id: nil, extractor: nil, image_color_extractor: nil)
      @user_id = user_id
      @extractor = extractor
      @image_color_extractor = image_color_extractor
    end

    def parse(html:, url:, store:, variant_id: nil)
      @extraction_failure = nil
      @image_colors = {}
      @document = Nokogiri::HTML(html)
      @url = url
      @store = store
      @text = @document.at_css("body")&.dup
      @text&.css("script, style, nav, footer")&.each(&:remove)
      @text = @text&.text.to_s.gsub(/[\u00a0\s]+/, " ").strip
      product = products.find do |entry|
        identity_matches?(entry) && (variant_id.blank? || same_sku?(entry["sku"].presence || entry["mpn"], variant_id))
      end
      raise Unverified, "選択した商品バリエーションを確認できません" if variant_id.present? && !product
      if needs_html_extraction?(product)
        begin
          extracted = (@extractor || HtmlProductExtractor.new(user_id: @user_id))
            .extract(document: @document, url:, tax_included_by_platform: store[:provider] == "yahoo_shopping")
          product = merge_extraction(product, extracted)
        rescue HtmlProductExtractor::Error => e
          raise Unverified, e.message unless product

          @extraction_failure = e.message
        end
      end
      raise Unverified, "対象バリエーションの商品情報がありません" unless product

      name = product["name"].to_s.strip
      raise Unverified, "公式の商品名がありません" if name.blank?

      category, slot = category_for(name, product)
      raise Unverified, "対応カテゴリを確認できません" unless category

      dimensions, evidence = dimensions_for(product, category)
      if category == "plant" && dimensions["h"] && dimensions["h"] < 0.5
        category, slot = "small_plant", "desk_top"
      end
      # Collection cases range from desk-top acrylic boxes to floor cabinets.
      if category == "acrylic_stand_case" && dimensions["h"] && dimensions["h"] >= 0.5
        category, slot = "display_case", "display"
      elsif category == "display_case" && dimensions["h"] && dimensions["h"] < 0.45
        category, slot = "acrylic_stand_case", "desk_top"
      end
      physical_size = %w[w h d].to_h { |axis| [ axis, dimensions[axis] ] }
      estimated_axes = []
      if (thin = THIN_AXES[category]) && dimensions[thin[0]].nil?
        dimensions[thin[0]] = thin[1]
        estimated_axes << thin[0]
      end
      %w[w h d].each do |axis|
        next if dimensions[axis]&.positive? && dimensions[axis] < 20

        physical_size[axis] = nil
        dimensions[axis] = ESTIMATED_SIZES.fetch(category, FALLBACK_SIZE).fetch(axis)
        estimated_axes << axis
      end

      price, availability, price_evidence = price_for(product)
      raise Unverified, "商品が売り切れまたは販売終了です" if availability == "out_of_stock"

      product_id = if store[:provider] == "yahoo_shopping"
        URI(url).path.delete_prefix("/").delete_suffix(".html")
      else
        product["sku"].presence || product["mpn"].presence || URI(url).path.split("/").last
      end
      # Article/SKU identifies IKEA/Nitori/MUJI's size and color variation. For a
      # retailer with a parent SKU, include published variant attributes as well.
      variant = if store[:provider] == "lowya"
        Digest::SHA256.hexdigest([ product_id, product["color"], physical_size ].to_json).first(24)
      else
        product_id.to_s
      end
      variants = ProductVariants.call(document: @document, url:, store:, product:)
      selected_variant = variants.find { |choice| same_sku?(choice["variant_id"], product_id) } || variants.find { |choice| choice["url"] == url }
      official_color = (product["color"].presence if product["color"].is_a?(String)) || selected_variant&.fetch("color_name")
      color_name = official_color || name
      color = COLORS.find { |pattern, _| pattern.match?(color_name) }&.last || "#bdb4a8"
      image = image_url(product)
      image_color = image_color_for(product)
      color = image_color["color"] if image_color["color"]
      shape = shape_for(name, category, evidence)
      extracted_shape = product.dig("_html_extraction", "shape")
      shape ||= extracted_shape if HtmlProductExtractor::SHAPES.include?(extracted_shape) && extracted_shape != "unknown"
      now = Time.current.iso8601
      metadata = {
        "provider" => store[:provider], "provider_product_id" => product_id.to_s, "variant_id" => variant,
        "extraction_method" => product["_html_extraction"] ? "gemini_html" : "structured_html",
        "source_url" => url, "fetched_at" => now, "price_checked_at" => now, "currency" => "JPY",
        "size" => physical_size, "size_source" => { "url" => url, "evidence" => evidence,
          "kind" => product["_html_extraction"] ? "official_html_with_gemini_extraction" : "official_page",
          "estimated_axes" => estimated_axes, "estimated_values_m" => dimensions.slice(*estimated_axes),
          "estimate_basis" => estimated_axes.any? ? "category_standard_dimensions" : nil },
        "estimated_axes" => estimated_axes, "material" => material_for(product),
        "official_color" => official_color, "color_variants" => variants, "color_name" => color_name, "color_source" => image_color["source"] || "official_color_name_approximation",
        "image_color" => image_color, "shape" => shape,
        "shape_source" => { "url" => url, "name" => name, "measurements" => evidence, "kind" => "category_and_official_text" },
        "availability" => availability, "price_source" => price_evidence, "tax_included" => true,
        "image_usage" => { "display" => "unconfirmed", "storage" => "unconfirmed", "generation_input" => "unconfirmed",
                           "source_url" => url }, "access_policy" => "public_html_robots_checked"
      }
      metadata["html_extraction"] = product["_html_extraction"] if product["_html_extraction"]
      metadata["html_extraction_failure"] = @extraction_failure if @extraction_failure
      { slot:, category:, name:, price:, shop: shop_name, url:, image_url: image, color:, size: dimensions, metadata: }
    end

    private

    # Yahoo! hosts many sellers; show the seller name from the breadcrumb when published.
    def shop_name
      return @store[:shop] unless @store[:provider] == "yahoo_shopping"

      seller = URI(@url).path.split("/")[1]
      crumb = @document.css('script[type="application/ld+json"]').filter_map do |script|
        JSON.parse(script.text)
      rescue JSON::ParserError
        nil
      end.flat_map { |value| value.is_a?(Array) ? value : [ value ] }.select { |value| value.is_a?(Hash) && value["@type"] == "BreadcrumbList" }
        .flat_map { |list| Array(list["itemListElement"]) }
        .find { |entry| entry.is_a?(Hash) && entry.dig("item", "@id").to_s.delete_suffix("/").end_with?("/#{seller}") }
      name = CGI.unescapeHTML(crumb&.dig("item", "name").to_s).strip.first(80)
      name.present? ? "#{name}（Yahoo!ショッピング）" : @store[:shop]
    end

    def needs_html_extraction?(product)
      return true unless product && product["name"].present?

      category, = category_for(product["name"].to_s, product)
      return true unless category

      dimensions, = dimensions_for(product, category)
      missing = %w[w h d] - dimensions.keys
      missing -= [ THIN_AXES[category]&.first ]
      price_for(product)
      unknown_color = product["color"].blank? && COLORS.keys.none? { |pattern| pattern.match?(product["name"].to_s) }
      missing.any? || material_for(product).blank? || (unknown_color && image_color_for(product)["color"].blank?)
    rescue Unverified
      true
    end

    def image_color_for(product)
      image = image_url(product)
      @image_colors[image] ||= (@image_color_extractor || ProductImageColor.new).call(url: image, provider: @store[:provider])
    end

    def merge_extraction(product, extracted)
      return extracted unless product

      structured_sku = product["sku"].presence || product["mpn"].presence
      raise HtmlProductExtractor::Error, "構造化商品番号とHTML抽出の商品番号が一致しません" if structured_sku && extracted["sku"].present? && structured_sku.to_s != extracted["sku"].to_s

      # Preserve structured identity/fields and supplement only missing data.
      merged = extracted.merge(product.reject { |_, value| value.blank? })
      merged["_html_extraction"] = extracted["_html_extraction"].dup
      category, = category_for(product["name"].to_s, product)
      merged["category"] = extracted["category"] unless category
      known_dimensions, = dimensions_for(product, category || extracted["category"])
      %w[w h d].zip(%w[width height depth]).each do |axis, property|
        if known_dimensions[axis]
          merged[property] = product[property]
          merged["_html_extraction"].delete(axis)
        elsif !quantitative_value(product[property])
          merged[property] = extracted[property]
        end
      end
      begin
        price_for(product)
        merged["_html_extraction"].delete("price_evidence")
        merged["_html_extraction"].delete("tax_evidence")
      rescue Unverified
        merged["offers"] = extracted["offers"]
      end
      merged
    end

    def products
      @document.css('script[type="application/ld+json"]').flat_map do |script|
        begin
          json_products(JSON.parse(script.text))
        rescue JSON::ParserError
          []
        end
      end
    end

    def json_products(value)
      case value
      when Array then value.flat_map { |entry| json_products(entry) }
      when Hash
        found = Array(value["@type"]).include?("Product") ? [ value ] : []
        found + value.values.select { |entry| entry.is_a?(Hash) || entry.is_a?(Array) }.flat_map { |entry| json_products(entry) }
      else []
      end
    end

    def same_sku?(left, right)
      return false if left.blank? || right.blank?

      @store[:provider] == "ikea" ? left.to_s.delete(".") == right.to_s.delete(".") : left.to_s == right.to_s
    end

    def identity_matches?(product)
      # Array(Hash) would split a single Offer object into key/value pairs.
      offers = product["offers"].is_a?(Array) ? product["offers"] : [ product["offers"] ]
      targets = [ product["url"], *offers.filter_map { |offer| offer["url"] if offer.is_a?(Hash) } ].compact
      return targets.any? { |target| same_page?(target) } if targets.any?

      # IKEA publishes variant SKU in Product even when Product.url is absent.
      id = product["sku"].presence || product["mpn"]
      id.present? && URI(@url).path.delete(".").include?(id.to_s.delete("."))
    end

    def same_page?(value)
      parsed = URI.join(@url, value.to_s)
      requested = URI(@url)
      parsed.host == requested.host && parsed.path.delete_suffix("/") == requested.path.delete_suffix("/") && identity_query(parsed) == identity_query(requested)
    rescue URI::InvalidURIError, ArgumentError
      false
    end

    def identity_query(uri)
      URI.decode_www_form(uri.query.to_s).reject { |key, _| key.match?(/\Autm_|\A(?:gclid|fbclid|msclkid)\z/i) }.sort
    end

    def category_for(name, product)
      rule = CATEGORY_RULES.find { |_, _, pattern| pattern.match?(name) } ||
        CATEGORY_RULES.find { |_, _, pattern| pattern.match?(product["category"].to_s) }
      return if rule && CARRIED_CHECK_CATEGORIES.include?(rule.first) && (PORTABLE_GOODS.match?(name) || (rule.first != "display_case" && WORN_GOODS.match?(name)))
      return rule.first(2) if rule

      category = product["category"].to_s
      return [ "small_plant", "desk_top" ] if category == "small_plant"

      CATEGORY_RULES.find { |entry| entry.first == category }&.first(2)
    end

    def material_for(product)
      header = @document.at_css('[class*="product-details-tab__material-header"]')
      text = header&.next_element&.text.to_s.gsub(/\s+/, " ").strip
      return text.first(1200) if text.present?

      @document.css("tr").each do |row|
        cells = row.css("th, td").map { |cell| cell.text.strip }
        return cells.drop(1).join(" ").first(1200) if cells.length >= 2 && %w[素材 材質 主な素材].include?(cells.first)
      end
      product["material"].to_s.first(1200)
    end

    def dimensions_for(product, category)
      dimensions = {}
      evidence = []
      %w[width height depth].zip(%w[w h d]).each do |property, axis|
        value = quantitative_value(product[property])
        next unless value

        dimensions[axis] = value
        evidence << (product.dig("_html_extraction", axis).presence || "JSON-LD #{property}: #{product[property].to_json}")
      end
      # IKEA's measurement rows exclude the package measurement panel entirely.
      @document.css('[class*="measurements-tab__measurement-row"]').each do |row|
        label = row.at_css('[class*="measurement-name"]')&.text.to_s
        text = row.at_css('[class*="measurement-value"]')&.text.to_s
        value = unit_value(text)
        next unless value

        thickness_axis = %w[wall_art wall_mirror curtain].include?(category) ? "d" : "h"
        axis = { "幅" => "w", "高さ" => "h", "奥行き" => "d", "長さ" => category == "curtain" ? "h" : "d", "厚さ" => thickness_axis, "高さ（最大）" => "h" }[label]
        if axis
          dimensions[axis] ||= value
          evidence << "#{label}: #{text}"
        elsif [ "直径", "ベースの直径" ].include?(label)
          dimensions["w"] ||= value
          dimensions["d"] ||= value
          evidence << "#{label}: #{text}"
        end
      end
      # Japanese retailers commonly place one actual-product row under 仕様・サイズ.
      # Do not match arbitrary page text: recommendations and package sizes are unsafe.
      @document.css("tr").each do |row|
        cells = row.css("th, td").map { |cell| cell.text.gsub(/\s+/, " ").strip }
        next unless cells.length >= 2 && %w[サイズ 外寸 商品サイズ 寸法].include?(cells.first)

        parse_dimension_line(cells.drop(1).join(" "), dimensions, evidence)
      end
      [ dimensions, evidence.uniq ]
    end

    def parse_dimension_line(line, dimensions, evidence)
      return if line.match?(/梱包|パッケージ|箱サイズ|内寸/)

      match = line.match(/幅\s*([\d.]+)\s*(cm|mm|m)?\s*[×xX・]\s*奥行(?:き)?\s*([\d.]+)\s*(cm|mm|m)?\s*[×xX・]\s*高さ\s*([\d.]+)\s*(cm|mm|m)/)
      # Francfranc: W795×D795×H630(SH:380)mm. The seat height note is not a size axis.
      match ||= line.match(/\AW\s*([\d.]+)\s*(cm|mm|m)?\s*[×xX]\s*D\s*([\d.]+)\s*(cm|mm|m)?\s*[×xX]\s*H\s*([\d.]+)\s*(?:\([^)]*\))?\s*(cm|mm|m)\z/)
      return unless match

      dimensions["w"] ||= unit_value("#{match[1]}#{match[2] || match[6]}")
      dimensions["d"] ||= unit_value("#{match[3]}#{match[4] || match[6]}")
      dimensions["h"] ||= unit_value("#{match[5]}#{match[6]}")
      evidence << line.first(300)
    end

    def quantitative_value(value)
      return unless value.is_a?(Hash)

      unit = { "CMT" => "cm", "MMT" => "mm", "MTR" => "m" }[value["unitCode"]] || value["unitText"]
      unit_value("#{value['value']} #{unit}")
    end

    def unit_value(text)
      match = text.match(/\A\s*([\d.]+)\s*(mm|cm|m)\s*\z/)
      return unless match

      (BigDecimal(match[1]) * { "mm" => 0.001, "cm" => 0.01, "m" => 1 }[match[2]]).to_f.round(6)
    rescue ArgumentError
      nil
    end

    def price_for(product)
      offers = Array(product["offers"].is_a?(Array) ? product["offers"] : [ product["offers"] ]).compact
      offers = offers.flat_map { |offer| offer["@type"] == "AggregateOffer" ? Array(offer["offers"]) : [ offer ] }
      offer = offers.find { |entry| entry["priceCurrency"] == "JPY" && (entry["url"].blank? || same_page?(entry["url"])) && entry["price"].present? }
      raise Unverified, "対象バリエーションの円価格がありません" unless offer
      tax_text = [ @text, product.dig("_html_extraction", "tax_evidence") ].compact.join(" ")
      # Yahoo! pages print "価格 999 円" without the word 税込; listed prices are
      # tax-inclusive under the mandatory total-price display rule.
      platform_tax_rule = @store[:provider] == "yahoo_shopping"
      raise Unverified, "消費税込みの根拠を確認できません" unless platform_tax_rule || tax_text.match?(/税込|消費税.*含|消費税込/)

      amount = BigDecimal(offer["price"].to_s.delete(","))
      evidence = platform_tax_rule ? "JSON-LD Offer.price (JPY, Yahoo!ショッピングの税込総額表示)" : "JSON-LD Offer.price (JPY)"
      if product.dig("_html_extraction", "price_evidence").present?
        evidence = { "kind" => "gemini_official_html", "evidence" => product.dig("_html_extraction", "price_evidence") }
      end
      if @store[:provider] == "ikea" && (regular = @text.match(/通常価格\s*[:：]?\s*¥\s*([\d,]+)/))
        amount = BigDecimal(regular[1].delete(","))
        evidence = "公式本文 通常価格（会員条件価格を除外）"
      end
      raise Unverified, "正の整数価格を確認できません" unless amount.positive? && amount.frac.zero?

      status = case offer["availability"].to_s
      when /OutOfStock|Discontinued|SoldOut/ then "out_of_stock"
      when /InStock|LimitedAvailability/ then "in_stock"
      when /PreOrder|BackOrder/ then "back_order"
      else "unknown"
      end
      [ amount.to_i, status, evidence ]
    rescue ArgumentError
      raise Unverified, "価格を数値として確認できません"
    end

    def shape_for(name, category, evidence)
      return "round" if name.match?(/円形|丸型|ラウンド/) || (%w[rug table wall_mirror].include?(category) && evidence.any? { |line| line.start_with?("直径:") })
      return "oval" if name.match?(/楕円|オーバル/)
      return "corner_left" if name.match?(/左(?:側)?カウチ|左コーナー/)
      return "corner_right" if name.match?(/右(?:側)?カウチ|右コーナー/)
      return "corner" if name.match?(/コーナー|カウチ/)
      return "tripod" if name.match?(/三脚/)

      return "rectangular" if name.match?(/長方形|四角|スクエア/) || (category == "rug" && evidence.any? { |line| line.start_with?("幅:") } && evidence.any? { |line| line.start_with?("長さ:") })

      nil
    end

    def image_url(product)
      images = product["image"].is_a?(Array) ? product["image"] : [ product["image"] ]
      candidates = images.map { |image| image.is_a?(Hash) ? image["contentUrl"] || image["url"] : image }
      candidates += @document.css('meta[property="og:image"], meta[name="og:image"], meta[name="twitter:image"]').map { |node| node["content"] }
      resolved = candidates.filter_map do |value|
        next unless value.is_a?(String) && value.present?

        target = URI.join(@url, value.to_s)
        if target.scheme == "http"
          secure = URI.parse(target.to_s.sub(/\Ahttp:/, "https:"))
          target = secure if ProductImageFetcher.allowed?(secure.to_s, provider: @store[:provider])
        end
        target.to_s if target.scheme == "https" && target.port == 443 && target.userinfo.nil?
      rescue URI::InvalidURIError
        nil
      end
      resolved.find { |target| ProductImageFetcher.allowed?(target, provider: @store[:provider]) } || resolved.first
    end
  end
end
