# frozen_string_literal: true

require "spec_helper"

RSpec.describe Authenticator do
  # Minimal host class that includes the module (mimicking AuthMiddleware usage).
  let(:host) do
    obj = Object.new
    obj.extend(Authenticator)
    obj
  end

  let(:valid_token) do
    JWT.encode(
      { sub: "user", exp: Time.now.to_i + 3600 },
      AppConfig.get(:auth, :jwt_secret),
      "HS256"
    )
  end

  let(:expired_token) do
    JWT.encode(
      { sub: "user", exp: Time.now.to_i - 3600 },
      AppConfig.get(:auth, :jwt_secret),
      "HS256"
    )
  end

  describe "#bearer_token" do
    it "extracts a Bearer token from the Authorization header" do
      env = { "HTTP_AUTHORIZATION" => "Bearer #{valid_token}" }
      expect(host.send(:bearer_token, env)).to eq(valid_token)
    end

    it "returns nil when Authorization header is absent" do
      expect(host.send(:bearer_token, {})).to be_nil
    end

    it "returns nil for non-Bearer auth schemes" do
      env = { "HTTP_AUTHORIZATION" => "Basic dXNlcjpwYXNz" }
      expect(host.send(:bearer_token, env)).to be_nil
    end
  end

  describe "#verify_jwt" do
    it "returns the payload for a valid token" do
      payload = host.send(:verify_jwt, valid_token)
      expect(payload["sub"]).to eq("user")
    end

    it "returns nil for an expired token" do
      expect(host.send(:verify_jwt, expired_token)).to be_nil
    end

    it "returns nil for a malformed token" do
      expect(host.send(:verify_jwt, "not.a.token")).to be_nil
    end
  end

  describe "#verify_api_key" do
    before do
      allow(AppConfig).to receive(:get).with(:auth, :api_keys).and_return(["valid-key-abc"])
    end

    it "returns a principal hash for a known key" do
      result = host.send(:verify_api_key, "valid-key-abc")
      expect(result["sub"]).to eq("api_key")
      expect(result["key"]).to eq("valid-key-abc")
    end

    it "returns nil for an unknown key" do
      expect(host.send(:verify_api_key, "bogus")).to be_nil
    end
  end

  describe "#unauthorized" do
    it "returns a 401 Rack response with a JSON error body" do
      status, headers, body = host.send(:unauthorized)
      expect(status).to eq(401)
      expect(headers["content-type"]).to eq("application/json")
      parsed = Oj.load(body.first, mode: :compat)
      expect(parsed["error"]).to eq("Unauthorized")
    end
  end
end
