# frozen_string_literal: true

require "spec_helper"

# Smoke-level boot test: verifies the full application stack comes up correctly.
# Detailed endpoint tests live in spec/requests/.
RSpec.describe "Application boot smoke test", type: :request do
  describe "GET /health" do
    it "returns 200 without auth" do
      get "/health"
      expect(last_response.status).to eq(200)
      expect(json_body["status"]).to eq("ok")
      expect(json_body["database"]["ok"]).to be true
    end

    it "reports all 6 built-in plugins loaded" do
      get "/health"
      names = json_body.dig("plugins", "plugins").map { |p| p["name"] }
      expect(names).to include("ebook", "music", "pic", "video", "game", "online_viewer")
    end
  end

  describe "GET /plugins" do
    it "returns 200 with auth" do
      get_authed "/plugins"
      expect(last_response.status).to eq(200)
      expect(json_body.map { |p| p["name"] }).to include("ebook")
    end

    it "returns 401 without auth" do
      get "/plugins"
      expect(last_response.status).to eq(401)
    end
  end

  describe "GET /resources" do
    it "returns an empty list with auth" do
      get_authed "/resources"
      expect(last_response.status).to eq(200)
      expect(json_body).to eq([])
    end
  end

  describe "POST /resources" do
    it "creates a resource and returns 201" do
      post_json "/resources", { name: "test.epub", type: "ebook", plugin: "ebook",
                                locations: ["/nas/books/test.epub"] }
      expect(last_response.status).to eq(201)
      expect(json_body["name"]).to eq("test.epub")
      expect(json_body["id"]).to be_a(Integer)
    end

    it "returns 422 for missing required fields" do
      post_json "/resources", { name: "" }
      expect(last_response.status).to eq(422)
    end
  end

  describe "GET /resources/duplicates" do
    it "returns empty list when no duplicates" do
      get_authed "/resources/duplicates"
      expect(last_response.status).to eq(200)
      expect(json_body).to eq([])
    end
  end
end

