require "uri"

# 家具の 3D モデル (GLB)。GLB のパス・URL・配信元・部位を扱う
class Furniture3DModel < ApplicationRecord
  self.table_name = "furniture_3d_models"

  class ConfigurationError < StandardError; end

  UNIT = "meter".freeze
  AXES = "+Y up, +Z front, origin bottom center".freeze
  KEY_PATTERN = /\A[a-zA-Z0-9][a-zA-Z0-9_-]*\z/
  OBJECT_KEY_PREFIX = "models/furniture/v1".freeze
  # 主な部位。形で決まるもの以外は、この順で最初に持っている部位
  PRIMARY_COLOR_KEYS = %w[tint wood fabric fabric_base rattan weave leaf pot metal].freeze
  SHAPE_PRIMARY_COLOR_KEYS = { "hanger_rack" => "metal", "floor_lamp_slim" => "light",
                               "led_strip_segment" => "light", "fairy_lights" => "light", "neon_sign" => "light" }.freeze

  belongs_to :furniture, inverse_of: :model

  validates :model_key, presence: true, uniqueness: true, format: { with: KEY_PATTERN }
  validates :shape, presence: true
  validates :format, inclusion: { in: %w[glb] }
  validates :width, :height, :depth, numericality: { greater_than: 0, less_than: 10_000 }
  validates :triangle_count, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :byte_size, numericality: { only_integer: true, greater_than: 0 }
  validates :sha256, format: { with: /\A[0-9a-f]{64}\z/ }
  validate :valid_color_material_keys

  def self.object_key_for(model_key)
    "#{OBJECT_KEY_PREFIX}/#{model_key}.glb"
  end

  # GLB・模様の画像の配信元。FURNITURE_MODEL_BASE_URL、無ければ MODELS_BUCKET の公開 URL。どちらも無ければ nil
  def self.asset_base_url
    value = ENV["FURNITURE_MODEL_BASE_URL"]
    if value.blank?
      bucket = ENV["MODELS_BUCKET"]
      return nil if bucket.blank?

      unless bucket.match?(/\A[a-z0-9][a-z0-9._-]{1,220}[a-z0-9]\z/)
        raise ConfigurationError, "MODELS_BUCKET must be a GCS bucket name"
      end
      value = "https://storage.googleapis.com/#{bucket}"
    end

    uri = URI.parse(value)
    unless uri.is_a?(URI::HTTPS) && uri.host.present? && uri.userinfo.nil? && uri.query.nil? && uri.fragment.nil?
      raise ConfigurationError, "FURNITURE_MODEL_BASE_URL must be an HTTPS base URL without credentials, query or fragment"
    end

    value.delete_suffix("/")
  rescue URI::InvalidURIError
    raise ConfigurationError, "FURNITURE_MODEL_BASE_URL is not a valid URL"
  end

  # バケット内の GLB のパス
  def object_key
    self.class.object_key_for(model_key)
  end

  # GLB の URL。配信元が無ければ nil
  def url(base: self.class.asset_base_url)
    return nil if base.nil?

    "#{base}/#{object_key.split('/').map { |segment| URI.encode_www_form_component(segment) }.join('/')}"
  end

  def size
    { "w" => width.to_f, "h" => height.to_f, "d" => depth.to_f }
  end

  # 主な部位。画面で色を変えた家具はこの部位を塗り替える
  def primary_color_key
    key = SHAPE_PRIMARY_COLOR_KEYS[shape]
    return key if color_material_keys.include?(key)

    PRIMARY_COLOR_KEYS.find { |name| color_material_keys.include?(name) } || color_material_keys.first
  end

  # 寸法比のずれ (倍率の対数の絶対値の合計)。測れない軸は数えない
  def size_distance(size)
    return 0 unless size.is_a?(Hash)

    [ [ width, size["w"] ], [ height, size["h"] ], [ depth, size["d"] ] ].sum do |model_value, value|
      value.to_f.positive? ? Math.log(model_value.to_f / value.to_f).abs : 0
    end
  end

  private

  def valid_color_material_keys
    unless color_material_keys.is_a?(Array) && color_material_keys.all? { |key| key.is_a?(String) }
      errors.add(:color_material_keys, "must be an array of strings")
    end
  end
end
