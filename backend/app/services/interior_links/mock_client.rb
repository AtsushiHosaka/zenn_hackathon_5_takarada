require "erb"

module InteriorLinks
  # インテリアリンク取得のモック。config/interior_links_mock.yml の静的な商品から、
  # テーマと枠で候補を絞って返す。prompt は使わない (本物は検索語の生成に使う想定)。
  # 確認済みの商品は参考価格と商品詳細URLを使う。未確認の商品は従来の検索リンクを使う。
  class MockClient
    SEARCH_URLS = {
      "amazon" => "https://www.amazon.co.jp/s?k=%s",
      "rakuten" => "https://search.rakuten.co.jp/search/mall/%s/"
    }.freeze

    def search(theme:, slots:, max_price:, **)
      rows.select { |row| (theme.nil? || row["themes"].include?(theme)) && slots.include?(row["slot"]) && row["price"] <= max_price }
          .map { |row| to_item(row) }
          .group_by(&:slot)
    end

    private

    def rows
      @rows ||= YAML.load_file(Rails.root.join("config/interior_links_mock.yml"))
    end

    def to_item(row)
      Item.build(
        id: row["id"],
        slot: row["slot"],
        category: row["category"],
        name: row["name"],
        price: row["price"],
        shop: row["shop"],
        url: row["url"].presence || format(SEARCH_URLS.fetch(row["shop"]), ERB::Util.url_encode(row["query"])),
        image_url: row["image_url"],
        color: row["color"],
        size: row["size"]
      )
    end
  end
end
