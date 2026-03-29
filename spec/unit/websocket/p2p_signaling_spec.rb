# frozen_string_literal: true

require "spec_helper"

RSpec.describe Websocket::P2PSignaling do
  subject(:signaling) { described_class.instance }

  # Helpers to inject/remove rooms without going through the full WS lifecycle.
  def inject_room(room_id, peers = {})
    signaling.synchronize do
      signaling.instance_variable_get(:@rooms)[room_id] = peers
    end
  end

  def remove_room(room_id)
    signaling.synchronize do
      signaling.instance_variable_get(:@rooms).delete(room_id)
    end
  end

  describe "#rooms_summary" do
    it "returns an empty array when no rooms exist" do
      expect(signaling.rooms_summary).to be_a(Array)
    end

    it "returns room_id and peer_count for each active room" do
      inject_room("room-a", { "peer-1" => double("ws"), "peer-2" => double("ws") })
      inject_room("room-b", {})

      summary = signaling.rooms_summary
      room_a = summary.find { |r| r[:room_id] == "room-a" }
      room_b = summary.find { |r| r[:room_id] == "room-b" }

      expect(room_a[:peer_count]).to eq(2)
      expect(room_b[:peer_count]).to eq(0)
    ensure
      remove_room("room-a")
      remove_room("room-b")
    end
  end

  describe "#room_peer_ids" do
    it "returns nil for a non-existent room" do
      expect(signaling.room_peer_ids("ghost-room")).to be_nil
    end

    it "returns the list of peer_ids for an existing room" do
      inject_room("test-room", { "p1" => double("ws"), "p2" => double("ws") })
      expect(signaling.room_peer_ids("test-room")).to contain_exactly("p1", "p2")
    ensure
      remove_room("test-room")
    end

    it "returns an empty array for a room with no peers" do
      inject_room("empty-room", {})
      expect(signaling.room_peer_ids("empty-room")).to eq([])
    ensure
      remove_room("empty-room")
    end
  end

  describe "#room_exists?" do
    it "returns false for a non-existent room" do
      expect(signaling.room_exists?("no-room")).to be false
    end

    it "returns true when the room exists" do
      inject_room("yes-room")
      expect(signaling.room_exists?("yes-room")).to be true
    ensure
      remove_room("yes-room")
    end
  end
end
