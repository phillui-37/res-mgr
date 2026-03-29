# frozen_string_literal: true

require "spec_helper"

RSpec.describe AuthMiddleware do
  let(:inner_app) { ->(env) { [200, { "content-type" => "text/plain" }, ["OK"]] } }
  let(:middleware) { described_class.new(inner_app) }

  def env_for(path, headers = {})
    Rack::MockRequest.env_for(path, headers)
  end

  def valid_jwt
    JWT.encode(
      { sub: "test_user", exp: Time.now.to_i + 3600 },
      AppConfig.get(:auth, :jwt_secret),
      "HS256"
    )
  end

  describe "skip paths" do
    it "passes /health through without authentication" do
      status, = middleware.call(env_for("/health"))
      expect(status).to eq(200)
    end

    it "passes /status through without authentication" do
      status, = middleware.call(env_for("/status"))
      expect(status).to eq(200)
    end

    it "passes WebSocket upgrade requests through (auth delegated to Websocket::Auth)" do
      env = env_for("/ws", "HTTP_UPGRADE" => "websocket")
      status, = middleware.call(env)
      expect(status).to eq(200)
    end

    it "blocks requests to other paths without a token" do
      status, = middleware.call(env_for("/plugins"))
      expect(status).to eq(401)
    end
  end

  describe "JWT authentication" do
    it "allows requests with a valid Bearer token" do
      env = env_for("/resources", "HTTP_AUTHORIZATION" => "Bearer #{valid_jwt}")
      status, = middleware.call(env)
      expect(status).to eq(200)
    end

    it "sets env['res_mgr.principal'] for downstream apps" do
      captured = nil
      app_with_capture = lambda do |env|
        captured = env["res_mgr.principal"]
        [200, {}, []]
      end
      mw = described_class.new(app_with_capture)
      mw.call(env_for("/resources", "HTTP_AUTHORIZATION" => "Bearer #{valid_jwt}"))
      expect(captured).to include("sub" => "test_user")
    end

    it "returns 401 for an expired JWT" do
      token = JWT.encode(
        { sub: "old", exp: Time.now.to_i - 10 },
        AppConfig.get(:auth, :jwt_secret), "HS256"
      )
      env = env_for("/resources", "HTTP_AUTHORIZATION" => "Bearer #{token}")
      status, = middleware.call(env)
      expect(status).to eq(401)
    end

    it "returns 401 for a token signed with the wrong secret" do
      token = JWT.encode({ sub: "hacker", exp: Time.now.to_i + 3600 }, "wrong-secret", "HS256")
      env = env_for("/resources", "HTTP_AUTHORIZATION" => "Bearer #{token}")
      status, = middleware.call(env)
      expect(status).to eq(401)
    end
  end

  describe "API key authentication" do
    let(:api_key) { "test-api-key-123" }

    before do
      allow(AppConfig).to receive(:get).and_call_original
      allow(AppConfig).to receive(:get).with(:auth, :api_keys).and_return([api_key])
    end

    it "allows requests with a valid X-API-Key header" do
      env = env_for("/resources", "HTTP_X_API_KEY" => api_key)
      status, = middleware.call(env)
      expect(status).to eq(200)
    end

    it "returns 401 for an unknown API key" do
      env = env_for("/resources", "HTTP_X_API_KEY" => "bad-key")
      status, = middleware.call(env)
      expect(status).to eq(401)
    end
  end

  describe "401 response shape" do
    it "returns JSON content-type and error body" do
      status, headers, body = middleware.call(env_for("/protected"))
      expect(status).to eq(401)
      expect(headers["content-type"]).to eq("application/json")
      parsed = Oj.load(body.first, mode: :compat)
      expect(parsed["error"]).to eq("Unauthorized")
    end
  end
end
