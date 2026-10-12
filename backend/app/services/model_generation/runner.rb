require "net/http"

module ModelGeneration
  # 生成のジョブを起動する。待たない (結果は ModelGeneration.sync が置き場から取り込む)。
  #   本番: MODEL_BUILDER_JOB (Cloud Run のジョブ名) を、置き場のパスを環境変数で渡して実行する
  #   手元: MODEL_BUILDER_COMMAND (例: "/path/to/venv/bin/python /repo/tools/furniture_models/generator/generate.py") を裏で起動する
  module Runner
    SCOPE = "https://www.googleapis.com/auth/cloud-platform".freeze

    def self.available?
      ENV["MODEL_BUILDER_JOB"].present? || ENV["MODEL_BUILDER_COMMAND"].present?
    end

    def self.start(generation)
      if ENV["MODEL_BUILDER_JOB"].present?
        run_job(generation)
      else
        spawn_local(generation)
      end
    end

    # Cloud Run Admin API の jobs.run。API のサービスアカウントに、このジョブを上書き付きで実行する権限が要る (infra/gcp/model_builder.tf)
    def self.run_job(generation)
      project = ENV.fetch("MODEL_BUILDER_PROJECT")
      region = ENV.fetch("MODEL_BUILDER_REGION")
      uri = URI("https://run.googleapis.com/v2/projects/#{project}/locations/#{region}/jobs/#{ENV.fetch('MODEL_BUILDER_JOB')}:run")
      headers = { "Content-Type" => "application/json" }
      Google::Auth.get_application_default([ SCOPE ]).apply!(headers)
      body = { overrides: { containerOverrides: [ { env: [ { name: "GENERATION_URI", value: "gs://#{ModelGeneration.bucket}/#{generation.prefix}" } ] } ] } }
      response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 5, read_timeout: 20) { |http| http.post(uri.path, body.to_json, headers) }
      raise Error, "Cloud Run (#{response.code}): #{response.body.to_s.truncate(200)}" unless response.is_a?(Net::HTTPSuccess)
    end

    # 手元では置き場が tmp/storage/<bucket>/ のディレクトリなので、そのパスを渡す
    def self.spawn_local(generation)
      directory = Rails.root.join("tmp/storage", ModelGeneration.bucket, generation.prefix).to_s
      log = Rails.root.join("log/model_generation.log").to_s
      pid = Process.spawn({ "GENERATION_URI" => directory }, *ENV.fetch("MODEL_BUILDER_COMMAND").shellsplit, out: [ log, "a" ], err: [ log, "a" ])
      Process.detach(pid)
    end
    private_class_method :run_job, :spawn_local
  end
end
