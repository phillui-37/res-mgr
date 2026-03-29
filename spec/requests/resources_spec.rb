# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Resource endpoints", type: :request do
  describe "GET /resources" do
    it "returns 401 without auth" do
      get "/resources"
      expect(last_response.status).to eq(401)
    end

    it "returns an empty array when no resources exist" do
      get_authed "/resources"
      expect(last_response.status).to eq(200)
      expect(json_body).to eq([])
    end

    context "with resources present" do
      before do
        post_json "/resources", { name: "book.epub",   type: "ebook",  plugin: "ebook",
                                  locations: ["/nas/books/book.epub"] }
        post_json "/resources", { name: "track.mp3",   type: "music",  plugin: "music" }
        post_json "/resources", { name: "photo.jpg",   type: "pic",    plugin: "pic" }
      end

      it "returns all active resources" do
        get_authed "/resources"
        expect(json_body.size).to eq(3)
      end

      it "filters by plugin" do
        get_authed "/resources", { "plugin" => "ebook" }
        expect(json_body.all? { |r| r["plugin"] == "ebook" }).to be true
      end

      it "filters by type" do
        get_authed "/resources", { "type" => "music" }
        expect(json_body.all? { |r| r["type"] == "music" }).to be true
      end

      it "filters by name (partial match)" do
        get_authed "/resources", { "name" => "book" }
        names = json_body.map { |r| r["name"] }
        expect(names).to include("book.epub")
        expect(names).not_to include("track.mp3")
      end
    end
  end

  describe "POST /resources" do
    it "creates a resource and returns 201" do
      post_json "/resources", {
        name: "novel.epub", type: "ebook", plugin: "ebook",
        locations: ["/nas/books/novel.epub"]
      }
      expect(last_response.status).to eq(201)
      expect(json_body["name"]).to eq("novel.epub")
      expect(json_body["id"]).to be_a(Integer)
    end

    it "returns 422 when name is missing" do
      post_json "/resources", { type: "ebook", plugin: "ebook" }
      expect(last_response.status).to eq(422)
      expect(json_body["error"]).to include("name")
    end

    it "returns 422 when type is missing" do
      post_json "/resources", { name: "x.epub", plugin: "ebook" }
      expect(last_response.status).to eq(422)
    end

    it "returns 422 when plugin is missing" do
      post_json "/resources", { name: "x.epub", type: "ebook" }
      expect(last_response.status).to eq(422)
    end
  end

  describe "GET /resources/:id" do
    let!(:resource_id) do
      post_json "/resources", { name: "r.epub", type: "ebook", plugin: "ebook" }
      json_body["id"]
    end

    it "returns 200 with the resource" do
      get_authed "/resources/#{resource_id}"
      expect(last_response.status).to eq(200)
      expect(json_body["id"]).to eq(resource_id)
    end

    it "returns 404 for a nonexistent id" do
      get_authed "/resources/999999"
      expect(last_response.status).to eq(404)
    end
  end

  describe "PATCH /resources/:id" do
    let!(:resource_id) do
      post_json "/resources", { name: "old.epub", type: "ebook", plugin: "ebook" }
      json_body["id"]
    end

    it "updates the resource and returns 200" do
      patch_json "/resources/#{resource_id}", { name: "new.epub" }
      expect(last_response.status).to eq(200)
      expect(json_body["name"]).to eq("new.epub")
    end

    it "returns 422 when update makes the resource invalid" do
      patch_json "/resources/#{resource_id}", { name: "" }
      expect(last_response.status).to eq(422)
    end
  end

  describe "DELETE /resources/:id" do
    let!(:resource_id) do
      post_json "/resources", { name: "del.epub", type: "ebook", plugin: "ebook" }
      json_body["id"]
    end

    it "soft-deletes the resource" do
      delete "/resources/#{resource_id}", {}, auth_header
      expect(last_response.status).to eq(200)
      expect(json_body["deleted"]).to eq(resource_id)
    end

    it "hides the deleted resource from the list" do
      delete "/resources/#{resource_id}", {}, auth_header
      get_authed "/resources"
      ids = json_body.map { |r| r["id"] }
      expect(ids).not_to include(resource_id)
    end
  end

  describe "GET /resources/duplicates" do
    it "returns an empty array when no duplicates exist" do
      get_authed "/resources/duplicates"
      expect(last_response.status).to eq(200)
      expect(json_body).to eq([])
    end

    it "returns duplicate groups when resources share a checksum" do
      post_json "/resources", { name: "a.epub", type: "ebook", plugin: "ebook" }
      id_a = json_body["id"]
      post_json "/resources", { name: "b.epub", type: "ebook", plugin: "ebook" }
      id_b = json_body["id"]

      checksum = "abcdef1234567890"
      Resource.where(id: [id_a, id_b]).update(checksum: checksum)

      get_authed "/resources/duplicates"
      expect(last_response.status).to eq(200)
      expect(json_body).not_to be_empty
      group = json_body.find { |g| g["checksum"] == checksum }
      expect(group["count"]).to eq(2)
      expect(group["resources"].size).to eq(2)
    end
  end

  describe "POST /resources/:id/remove-request" do
    let!(:resource_id) do
      post_json "/resources", { name: "rm.epub", type: "ebook", plugin: "ebook" }
      json_body["id"]
    end

    it "returns 200 with pending_confirmation status" do
      # Stub the WebSocket publish to avoid real WS dependency
      allow(Websocket::Hub.instance).to receive(:publish)
      post "/resources/#{resource_id}/remove-request", {}, auth_header
      expect(last_response.status).to eq(200)
      expect(json_body["status"]).to eq("pending_confirmation")
      expect(json_body["resource_id"]).to eq(resource_id)
    end

    it "returns 422 for online_viewer resources" do
      post_json "/resources", { name: "stream.url", type: "url", plugin: "online_viewer" }
      ov_id = json_body["id"]
      allow(Websocket::Hub.instance).to receive(:publish)
      post "/resources/#{ov_id}/remove-request", {}, auth_header
      expect(last_response.status).to eq(422)
    end
  end
end
