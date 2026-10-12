require "rails_helper"

RSpec.describe CoordinationBuilder do
  before do
    CharacterImporter.call
    FurnitureImporter.call
    FurnitureTextureImporter.call
    FurnitureDetailImporter.call
    allow(GeminiClient).to receive(:configured?).and_return(true)
    allow(FurnitureQuery).to receive(:call).and_return(FurnitureQuery::Result.new(categories: [], shapes: [], color: nil, themes: [], source: "rules"))
    allow(GeminiClient).to receive(:new).and_return(gemini)
  end

  let(:room) { create(:user).rooms.create!(tatami: 6, shape: "standard").tap { |r| r.update!(scene: RoomAnalyzer.call(r).scene, analyzed_by: "mock", status: "ready") } }
  let(:coordination) { room.coordinations.create!(prompt: "北欧っぽい落ち着いた部屋にしたい") }
  let(:prompts) { [] }
  let(:gemini) do
    instance_double(GeminiClient).tap do |client|
      allow(client).to receive(:generate_json) do |prompt:, **|
        prompts << prompt
        GeminiClient::Response.new(json: { "title" => "北欧の部屋", "concept" => "落ち着いた色でまとめます。", "unavailable_note" => "", "remove_object_ids" => [], "picks" => picks },
                                   model: "test", thinking_level: nil, usage: {}, elapsed: 0.0)
      end
    end
  end
  # 枠ごとに、並び順の先頭から count 件を採用する回答
  let(:picks) do
    { "wall_decor" => 4, "cushion" => 2, "desk_top" => 3, "rug" => 2, "floor" => 3 }.map do |slot, count|
      ids = FurnitureDetail.available.where(slot:).order(:position, :id).limit(count).pluck(:id)
      # 床は、候補に必ず入る「形ごとの先頭の椅子」から選ぶ
      ids = FurnitureDetail.available.where(category: "chair").order(:position, :id).preload(furniture: :model).group_by { |detail| detail.furniture.model.shape }.values.map { |details| details.first.id }.first(count) if slot == "floor"
      { "group_id" => slot, "slot" => slot, "selected_item_ids" => ids, "item_ids" => ids }
    end
  end

  it "1 つの枠に複数の商品を、上限までで重ならないように置く" do
    result = described_class.call(coordination)
    placed = result.after_scene["objects"].select { |object| object["source"] == "suggested" }
    counts = result.items.map { |item| item["slot"] }.tally

    expect(counts["wall_decor"]).to be_between(2, CoordinationPlanner::MAX_PICKS.fetch("wall_decor"))
    expect(counts["desk_top"]).to be >= 2
    expect(counts["rug"]).to eq(1)
    expect(result.items.map { |item| item["item_id"] }).to eq(result.items.map { |item| item["item_id"] }.uniq)
    expect(placed.map { |object| object["id"] }).to eq(placed.map { |object| object["id"] }.uniq)
    placed.group_by { |object| [ object["slot"], object["attach_to"] ] }.each_value do |objects|
      expect(objects.map { |object| object["position"] }).to eq(objects.map { |object| object["position"] }.uniq)
    end
    expect(result.total_price).to eq(result.items.sum { |item| item["price"] })
  end

  it "部屋に無い種類の大型家具を、AI が選んだ分だけ上限までで足す" do
    result = described_class.call(coordination)
    floor = result.items.select { |item| item["slot"] == "floor" }

    expect(floor.size).to eq(CoordinationPlanner::MAX_PICKS.fetch("floor"))
    expect(floor.map { |item| item["category"] } & room.scene["objects"].pluck("category")).to be_empty
    expect(floor.first["placement_note"]).to start_with("デスクの前")
    expect(prompts.last).to include('"group_id":"floor"')
  end

  it "キャラクターのグッズは、要望にそのキャラクターが出てくるときだけ候補にする" do
    furniture = Character.find_by!(character_key: "hatsune_miku").furnitures.joins(:model).where(category: "cushion").first!
    FurnitureDetail.create!(key: "test:miku", furniture:, name: "ミクのクッション", category: "cushion", slot: "cushion", symbolic_color: "#36b5ab",
                            color_materials: { furniture.model.color_material_keys.first => "#36b5ab" }, width: 0.4, height: 0.1, depth: 0.4, price: 2000, shop: "test", url: "https://example.com/miku")

    described_class.call(coordination)
    described_class.call(room.coordinations.create!(prompt: "初音ミクの部屋にしたい"))

    expect(prompts.first).not_to include("ミクのクッション")
    expect(prompts.last).to include("ミクのクッション")
  end

  it "商品・壁・床の色を言葉でも渡す" do
    described_class.call(coordination)

    expect(prompts.last).to include('"color_word":"').and include("壁の色: #f4f1ec (白)").and include("床の色: #c8a97e (ベージュ)")
  end
end
