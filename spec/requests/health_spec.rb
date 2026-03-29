# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Health endpoints", type: :request do
  describe "GET /health" do
    it "returns 200 without authentication" do
      get "/health"
      expect(last_response.status).to eq(200)
    end

    it "returns JSON with status ok" do
      get "/health"
      expect(json_body["status"]).to eq("ok")
    end

    it "returns database info" do
      get "/health"
      expect(json_body["database"]).to include("ok" => true)
    end

    it "returns plugins info" do
      get "/health"
      expect(json_body["plugins"]).to include("count", "plugins")
    end

    it "returns a non-negative uptime" do
      get "/health"
      expect(json_body["uptime"]).to be >= 0
    end

    it "lists all 6 built-in plugins" do
      get "/health"
      names = json_body.dig("plugins", "plugins").map { |p| p["name"] }
      expect(names).to include("ebook", "music", "video", "game", "pic", "online_viewer")
    end
  end

  describe "GET /status" do
    it "returns 404 since /status is not defined as a route" do
      # /status is in SKIP_PATHS for auth but the app itself has no /status route.
      get "/status"
      expect(last_response.status).not_to eq(200)
    end
  end
end
