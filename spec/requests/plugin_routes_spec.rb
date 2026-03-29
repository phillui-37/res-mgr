# frozen_string_literal: true

require "spec_helper"

# Tests the plugin sub-resource routes (e.g. /resources/ebook/:id/progress).
# Verifies the routing bug fix: r.on Integer must come before r.get (always-matcher).
RSpec.describe "Plugin sub-resource routes", type: :request do
  let!(:ebook_id) do
    post_json "/resources", { name: "test.epub", type: "ebook", plugin: "ebook",
                              locations: ["/books/test.epub"] }
    json_body["id"]
  end

  let!(:music_id) do
    post_json "/resources", { name: "track.flac", type: "music", plugin: "music" }
    json_body["id"]
  end

  let!(:video_id) do
    post_json "/resources", { name: "film.mp4", type: "video", plugin: "video" }
    json_body["id"]
  end

  describe "GET /resources/ebook" do
    it "returns the ebook collection, not a 404 or routing error" do
      get_authed "/resources/ebook"
      expect(last_response.status).to eq(200)
      expect(json_body).to be_a(Array)
    end
  end

  describe "GET /resources/ebook/:id/progress" do
    it "returns progress for the resource (not the ebook collection)" do
      get_authed "/resources/ebook/#{ebook_id}/progress"
      expect(last_response.status).to eq(200)
      # Fresh resource has no progress records yet
      expect(json_body).to be_a(Array)
      expect(json_body).to be_empty
    end

    it "does NOT silently return the full ebook list for a sub-path GET" do
      get_authed "/resources/ebook/#{ebook_id}/progress"
      expect(last_response.status).to eq(200)
      # The full collection would be an array of resource hashes with "id" keys.
      # Progress records are plain rows without a top-level "name" key.
      expect(json_body.none? { |r| r["name"] }).to be true
    end
  end

  describe "POST /resources/ebook/:id/progress" do
    it "creates a progress record" do
      allow(Websocket::Hub.instance).to receive(:publish)
      post_json "/resources/ebook/#{ebook_id}/progress",
                { device: "kindle", current_page: 42, total_pages: 300, percentage: 14.0 }
      expect(last_response.status).to eq(200)
      expect(json_body["ok"]).to be true
    end

    it "subsequent GET returns the saved progress" do
      allow(Websocket::Hub.instance).to receive(:publish)
      post_json "/resources/ebook/#{ebook_id}/progress",
                { device: "kindle", current_page: 10, total_pages: 200 }

      get_authed "/resources/ebook/#{ebook_id}/progress"
      expect(last_response.status).to eq(200)
      row = json_body.find { |r| r[:device] == "kindle" || r["device"] == "kindle" }
      expect(row).not_to be_nil
    end
  end

  describe "GET /resources/music/:id/progress" do
    it "returns progress for a music resource" do
      get_authed "/resources/music/#{music_id}/progress"
      expect(last_response.status).to eq(200)
      expect(json_body).to be_a(Array)
    end
  end

  describe "GET /resources/video/:id/progress" do
    it "returns progress for a video resource" do
      get_authed "/resources/video/#{video_id}/progress"
      expect(last_response.status).to eq(200)
      expect(json_body).to be_a(Array)
    end
  end
end
