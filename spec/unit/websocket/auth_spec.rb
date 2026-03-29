# frozen_string_literal: true

require "spec_helper"

RSpec.describe Websocket::Auth do
  let(:inner_app)  { ->(env) { [200, { "content-type" => "text/plain" }, ["OK"]] } }
  let(:middleware) { described_class.new(inner_app) }

  def env_for(path, opts = {})
    Rack::MockRequest.env_for(path, opts)
  end

  def ws_env(path, opts = {})
    e = env_for(path, opts)
    allow(Faye::WebSocket).to receive(:websocket?).with(e).and_return(true)
    e
  end

  def valid_jwt
    JWT.encode(
      { sub: "ws_user", exp: Time.now.to_i + 3600 },
      AppConfig.get(:auth, :jwt_secret),
      "HS256"
    )
  end

  describe "non-WebSocket requests" do
    it "passes through without checking auth" do
      env = env_for("/api")
      allow(Faye::WebSocket).to receive(:websocket?).with(env).and_return(false)
      status, = middleware.call(env)
      expect(status).to eq(200)
    end
  end

  describe "WebSocket upgrade requests" do
    context "with no credentials" do
      it "returns 401" do
        env = ws_env("/ws")
        status, = middleware.call(env)
        expect(status).to eq(401)
      end
    end

    context "with a valid token in Authorization header" do
      it "allows the request through" do
        env = ws_env("/ws", "HTTP_AUTHORIZATION" => "Bearer #{valid_jwt}")
        status, = middleware.call(env)
        expect(status).to eq(200)
      end

      it "sets res_mgr.principal in env" do
        captured = nil
        app = lambda do |e| captured = e["res_mgr.principal"]; [200, {}, []] end
        mw  = described_class.new(app)
        env = ws_env("/ws", "HTTP_AUTHORIZATION" => "Bearer #{valid_jwt}")
        allow(Faye::WebSocket).to receive(:websocket?).with(env).and_return(true)
        mw.call(env)
        expect(captured).to include("sub" => "ws_user")
      end
    end

    context "with a valid token in ?token= query param" do
      it "allows the request through" do
        env = ws_env("/ws?token=#{valid_jwt}")
        status, = middleware.call(env)
        expect(status).to eq(200)
      end
    end

    context "with an expired JWT" do
      it "returns 401" do
        expired = JWT.encode({ sub: "old", exp: Time.now.to_i - 1 },
                             AppConfig.get(:auth, :jwt_secret), "HS256")
        env = ws_env("/ws", "HTTP_AUTHORIZATION" => "Bearer #{expired}")
        status, = middleware.call(env)
        expect(status).to eq(401)
      end
    end

    context "with a valid API key" do
      let(:api_key) { "ws-api-key" }

      before do
        allow(AppConfig).to receive(:get).and_call_original
        allow(AppConfig).to receive(:get).with(:auth, :api_keys).and_return([api_key])
      end

      it "allows the request through" do
        env = ws_env("/ws", "HTTP_X_API_KEY" => api_key)
        status, = middleware.call(env)
        expect(status).to eq(200)
      end
    end
  end

  describe "token_from_query (private)" do
    it "extracts the token parameter from a query string" do
      env = env_for("/ws?topics=a&token=my.jwt.token")
      result = middleware.send(:token_from_query, env)
      expect(result).to eq("my.jwt.token")
    end

    it "returns nil when token is absent" do
      env = env_for("/ws?topics=foo")
      expect(middleware.send(:token_from_query, env)).to be_nil
    end
  end
end
