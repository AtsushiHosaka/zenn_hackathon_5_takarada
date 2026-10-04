require "rails_helper"

RSpec.describe GeminiClient do
  describe ".configured?" do
    before do
      allow(Rails).to receive(:env).and_return("production".inquiry)
      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("GEMINI_API_KEY").and_return("configured-test-key")
      allow(ENV).to receive(:[]).with("GEMINI_ALLOWED_USER_IDS").and_return(nil)
    end

    it "keeps an existing production key active when no allowlist is configured" do
      expect(described_class.configured?).to be(true)
    end

    it "keeps the same key behavior in development" do
      allow(Rails).to receive(:env).and_return("development".inquiry)

      expect(described_class.configured?).to be(true)
    end

    it "disables real Gemini in tests even when a key is present" do
      allow(Rails).to receive(:env).and_return("test".inquiry)

      expect(described_class.configured?).to be(false)
    end

    it "disables real Gemini when the key is empty or missing" do
      allow(ENV).to receive(:[]).with("GEMINI_API_KEY").and_return("")

      expect(described_class.configured?(user_id: 10)).to be(false)

      allow(ENV).to receive(:[]).with("GEMINI_API_KEY").and_return(nil)
      allow(ENV).to receive(:[]).with("GEMINI_ALLOWED_USER_IDS").and_return("*")

      expect(described_class.configured?(user_id: 10)).to be(false)
    end

    it "disables all owners when the allowlist is explicitly empty" do
      allow(ENV).to receive(:[]).with("GEMINI_ALLOWED_USER_IDS").and_return("")

      expect(described_class.configured?(user_id: 10)).to be(false)
      expect(described_class.configured?).to be(false)
    end

    it "limits explicit owner lists to their matching server owner IDs" do
      allow(ENV).to receive(:[]).with("GEMINI_ALLOWED_USER_IDS").and_return(" 10, 11 ")

      expect(described_class.configured?(user_id: 10)).to be(true)
      expect(described_class.configured?(user_id: 11)).to be(true)
      expect(described_class.configured?(user_id: 12)).to be(false)
      expect(described_class.configured?).to be(false)
    end

    it "preserves the explicit wildcard setting" do
      allow(ENV).to receive(:[]).with("GEMINI_ALLOWED_USER_IDS").and_return("*")

      expect(described_class.configured?).to be(true)
    end
  end
end
