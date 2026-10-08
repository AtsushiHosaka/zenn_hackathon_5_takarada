require "uri"

# Registration stays closed until both public legal documents are configured.
class SignupPolicy
  MESSAGE = "正式な利用規約とプライバシーポリシーを準備中のため、現在は新規登録できません。".freeze
  DOCUMENT_KEYS = %w[VITE_TERMS_URL VITE_PRIVACY_URL].freeze

  def self.allowed?
    DOCUMENT_KEYS.all? { |key| valid_document_url?(ENV[key]) }
  end

  def self.valid_document_url?(value)
    return false unless value.is_a?(String) && !value.match?(/[\\\x00-\x1f\x7f]/)

    value = value.strip
    return false unless value.match?(%r{\A[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+\z})
    return false if value.match?(/%(?![0-9a-f]{2})/i)

    uri = URI.parse(value)
    if value.start_with?("/")
      !value.start_with?("//") && uri.host.nil? && uri.scheme.nil?
    else
      uri.is_a?(URI::HTTPS) && uri.host.present? && uri.userinfo.nil? && uri.port.between?(0, 65_535)
    end
  rescue URI::InvalidURIError
    false
  end
  private_class_method :valid_document_url?
end
