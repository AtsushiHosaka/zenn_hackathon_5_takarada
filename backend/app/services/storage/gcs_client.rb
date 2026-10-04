require "google/cloud/storage"
require "google/apis/iamcredentials_v1"

module Storage
  # Cloud Run のサービスアカウントは秘密鍵を持たず、gem は signBlob へ自動で
  # 切り替えてもくれないので、署名だけを IAM Credentials API に委譲する。
  # api のサービスアカウントに自分自身への serviceAccountTokenCreator が必要
  # (infra/gcp/storage.tf)。無いと signBlob の 403 で落ちる。
  class GcsClient
    SCOPE = "https://www.googleapis.com/auth/cloud-platform".freeze

    # 署名付き PUT では x-goog-content-length-range が使えない (POST policy 専用) ため、
    # Content-Type と Content-Length を署名ヘッダに入れて型と大きさを固定する
    def upload_url(asset, content_type:, size:, expires:)
      storage.signed_url(
        asset.bucket, asset.key,
        method: "PUT",
        version: :v4,
        expires: expires,
        headers: { "Content-Type" => content_type, "Content-Length" => size.to_s },
        issuer: issuer,
        signer: signer
      )
    end

    # 無ければ nil。アップロード完了の申告を信じず実物を見るために使う
    def metadata(asset)
      file = bucket(asset).file(asset.key)
      file && Metadata.new(size: file.size.to_i, content_type: file.content_type)
    end

    def delete(asset)
      bucket(asset).file(asset.key)&.delete
    end

    def download(asset)
      bucket(asset).file(asset.key)&.download&.string
    end

    private

    def storage
      @storage ||= Google::Cloud::Storage.new
    end

    def bucket(asset)
      storage.bucket(asset.bucket, skip_lookup: true)
    end

    def issuer
      ENV.fetch("STORAGE_SIGNER_EMAIL")
    end

    # SignerV4 は署名の生バイトを返す Proc を期待する (hex 化は gem 側)。
    # payload / signed_blob は base64 項目なので往復は gem が面倒を見る
    def signer
      lambda do |string_to_sign|
        request = Google::Apis::IamcredentialsV1::SignBlobRequest.new(payload: string_to_sign)
        iam.sign_service_account_blob("projects/-/serviceAccounts/#{issuer}", request).signed_blob
      end
    end

    def iam
      @iam ||= Google::Apis::IamcredentialsV1::IAMCredentialsService.new.tap do |service|
        service.authorization = Google::Auth.get_application_default([ SCOPE ])
      end
    end
  end
end
