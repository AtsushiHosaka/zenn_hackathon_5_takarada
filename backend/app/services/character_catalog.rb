# 推し活グッズ用のキャラクター・フランチャイズ・グッズ種別の辞書 (config/characters.json)。
class CharacterCatalog
  DATA = JSON.parse(File.read(Rails.root.join("config/characters.json"))).freeze
  FRANCHISES = DATA.fetch("franchises").index_by { |row| row.fetch("id") }.freeze
  CHARACTERS = DATA.fetch("characters").index_by { |row| row.fetch("id") }.freeze
  GOODS_TYPES = DATA.fetch("goods_types").index_by { |row| row.fetch("id") }.freeze

  def self.franchise(id)
    FRANCHISES[id]
  end

  def self.character(id)
    CHARACTERS[id]
  end

  def self.goods_type(id)
    GOODS_TYPES[id]
  end

  # キャラクターのフランチャイズが造形の作成を認めているか。
  def self.likeness_allowed?(character_id)
    franchise(character(character_id)&.fetch("franchise"))&.fetch("likeness_allowed") == true
  end

  # モデルに表示するクレジットと注意書き。フランチャイズごとに1件。
  def self.credits(character_ids)
    Array(character_ids).filter_map { |id| character(id)&.fetch("franchise") }.uniq.filter_map do |franchise_id|
      row = franchise(franchise_id)
      row && { franchise: franchise_id, credit: row["credit"], notice: row["notice"], license_url: row["license_url"] }
    end
  end
end
