# frozen_string_literal: true

require "spec_helper"

RSpec.describe "P2P endpoints", type: :request do
  describe "GET /p2p/rooms" do
    it "returns 401 without auth" do
      get "/p2p/rooms"
      expect(last_response.status).to eq(401)
    end

    it "returns an empty array when no rooms exist" do
      get_authed "/p2p/rooms"
      expect(last_response.status).to eq(200)
      expect(json_body).to eq([])
    end
  end

  describe "POST /p2p/rooms" do
    it "creates a room with the given room_id" do
      post_json "/p2p/rooms", { room_id: "my-room" }
      expect(last_response.status).to eq(200)
      expect(json_body["room_id"]).to eq("my-room")
      expect(json_body["ws_url"]).to include("my-room")
    end

    it "generates a UUID room_id when not provided" do
      post_json "/p2p/rooms", {}
      expect(json_body["room_id"]).to match(/[0-9a-f\-]{36}/)
    end
  end

  describe "GET /p2p/rooms/:id" do
    it "returns 404 for a room not in the signaling server" do
      get_authed "/p2p/rooms/nonexistent-room"
      expect(last_response.status).to eq(404)
      expect(json_body["error"]).to include("not found")
    end

    it "returns room info when the room exists in the signaling server" do
      room_id = "test-room-#{SecureRandom.hex(4)}"
      signaling = Websocket::P2PSignaling.instance

      signaling.synchronize { signaling.instance_variable_get(:@rooms)[room_id] = {} }

      get_authed "/p2p/rooms/#{room_id}"
      expect(last_response.status).to eq(200)
      expect(json_body["room_id"]).to eq(room_id)
      expect(json_body["peer_count"]).to eq(0)
      expect(json_body["shared_resources"]).to eq([])
    ensure
      signaling&.synchronize { signaling.instance_variable_get(:@rooms).delete(room_id) }
    end
  end

  describe "POST /p2p/rooms/:id/share" do
    let!(:resource_id) do
      post_json "/resources", { name: "shared.epub", type: "ebook", plugin: "ebook" }
      json_body["id"]
    end
    let(:room_id) { "share-room-#{SecureRandom.hex(4)}" }

    it "returns 422 when resource_id is missing" do
      post_json "/p2p/rooms/#{room_id}/share", {}
      expect(last_response.status).to eq(422)
    end

    it "returns 404 when resource does not exist" do
      allow(Websocket::Hub.instance).to receive(:publish)
      post_json "/p2p/rooms/#{room_id}/share", { resource_id: 999_999 }
      expect(last_response.status).to eq(404)
    end

    it "shares a resource into a room" do
      allow(Websocket::Hub.instance).to receive(:publish)
      post_json "/p2p/rooms/#{room_id}/share", { resource_id: resource_id }
      expect(last_response.status).to eq(200)
      expect(json_body["ok"]).to be true
      expect(json_body["room_id"]).to eq(room_id)
    end

    it "is idempotent (duplicate share does not raise)" do
      allow(Websocket::Hub.instance).to receive(:publish)
      post_json "/p2p/rooms/#{room_id}/share", { resource_id: resource_id }
      expect {
        post_json "/p2p/rooms/#{room_id}/share", { resource_id: resource_id }
      }.not_to raise_error
    end
  end

  describe "DELETE /p2p/rooms/:id/share/:resource_id" do
    let(:room_id) { "revoke-room-#{SecureRandom.hex(4)}" }
    let!(:resource_id) do
      post_json "/resources", { name: "revoke.epub", type: "ebook", plugin: "ebook" }
      json_body["id"]
    end

    it "revokes a shared resource" do
      allow(Websocket::Hub.instance).to receive(:publish)
      post_json "/p2p/rooms/#{room_id}/share", { resource_id: resource_id }

      delete "/p2p/rooms/#{room_id}/share/#{resource_id}", {}, auth_header
      expect(last_response.status).to eq(200)
      expect(json_body["ok"]).to be true
    end

    it "returns 404 when the resource was not shared" do
      delete "/p2p/rooms/#{room_id}/share/999999", {}, auth_header
      expect(last_response.status).to eq(404)
    end
  end
end
