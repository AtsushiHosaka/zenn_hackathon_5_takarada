module Api
  module V1
    # 部屋写真の置き場を決めて署名付き URL を発行する。中身はここを通らず
    # ブラウザから GCS へ直接送られる。規則は RoomPhoto が持つ。
    class UploadsController < ApplicationController
      skip_before_action :authenticate_identity!, only: :update

      # POST /api/v1/uploads
      def create
        requested = upload_params
        errors = validate(requested)
        return render json: { errors: errors }, status: :unprocessable_entity if errors.any?

        render json: UploadSerializer.new(RoomPhoto.issue(requested, user: current_user)), status: :created
      end

      # PUT /api/v1/uploads/*key
      # 開発用の受け口。本番は GCS が署名付き URL で直接受けるので通らない
      def update
        return head :not_found unless Rails.env.local?
        return head :bad_request unless params[:key].match?(RoomPhoto::KEY)

        return head :forbidden unless params[:token].is_a?(String)

        upload = Rails.application.message_verifier(:local_upload).verified(params[:token], purpose: :room_photo)
        return head :forbidden unless upload && upload["key"] == params[:key]
        return head :unprocessable_entity unless request.content_type == upload["content_type"]

        bytes = request.body.read(upload["size"] + 1).to_s
        return head :unprocessable_entity unless bytes.bytesize == upload["size"]

        Storage.client.store(RoomPhoto.asset(params[:key]), bytes)
        head :ok
      end

      private

      def upload_params
        params.permit(uploads: [ :content_type, :size ])
              .fetch(:uploads, [])
              .map { |upload| upload.to_h.symbolize_keys }
      end

      def validate(uploads)
        return [ "写真を 1〜#{RoomPhoto::MAX_COUNT} 枚で選んでください" ] unless uploads.size.between?(1, RoomPhoto::MAX_COUNT)

        messages = []
        messages << "対応していない画像形式があります" unless uploads.all? { |upload| RoomPhoto::CONTENT_TYPES.key?(upload[:content_type]) }
        messages << "写真は 1 枚 #{RoomPhoto::MAX_BYTES / 1024 / 1024}MB 以内にしてください" unless uploads.all? { |upload| upload[:size].to_i.between?(1, RoomPhoto::MAX_BYTES) }
        messages
      end
    end
  end
end
