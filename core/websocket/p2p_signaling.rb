# frozen_string_literal: true

require "securerandom"
require "singleton"
require "monitor"
require "logger"
require "oj"
require "faye/websocket"

module Websocket
  # P2PSignaling handles WebRTC signaling over WebSocket.
  # Clients connect to /ws/p2p?room=<room_id>&token=<jwt>
  #
  # Message protocol (JSON):
  #   Client → Server:
  #     { type: "join",    room: "..." }
  #     { type: "offer",   to: "<peer_id>", sdp: "..." }
  #     { type: "answer",  to: "<peer_id>", sdp: "..." }
  #     { type: "ice",     to: "<peer_id>", candidate: {...} }
  #     { type: "leave" }
  #
  #   Server → Client:
  #     { type: "joined",  peer_id: "...", peers: [...] }
  #     { type: "peer_joined",  peer_id: "..." }
  #     { type: "peer_left",    peer_id: "..." }
  #     { type: "offer",   from: "<peer_id>", sdp: "..." }
  #     { type: "answer",  from: "<peer_id>", sdp: "..." }
  #     { type: "ice",     from: "<peer_id>", candidate: {...} }
  #     { type: "error",   message: "..." }
  class P2PSignaling
    LOGGER = AppLogger.logger

    include Singleton
    include MonitorMixin

    def initialize
      super
      @rooms = {}      # room_id → { peer_id → ws }
      @peers = {}      # ws → { peer_id:, room_id: }
    end

    def call(env)
      return [426, {}, ["Upgrade Required"]] unless Faye::WebSocket.websocket?(env)
      return [401, {}, ["Unauthorized"]] unless env["res_mgr.principal"]

      ws      = Faye::WebSocket.new(env)
      peer_id = SecureRandom.uuid

      ws.on(:open)    { handle_open(ws, peer_id) }
      ws.on(:message) { |e| handle_message(ws, peer_id, e.data) }
      ws.on(:close)   { handle_close(ws, peer_id) }

      ws.rack_response
    end

    # Public API for room state inspection (used by P2PController).

    def rooms_summary
      synchronize do
        @rooms.map { |room_id, peers| { room_id: room_id, peer_count: peers.size } }
      end
    end

    # Returns the list of peer_ids in a room, or nil if the room does not exist.
    def room_peer_ids(room_id)
      synchronize { @rooms[room_id]&.keys }
    end

    def room_exists?(room_id)
      synchronize { @rooms.key?(room_id) }
    end

    private

    def handle_open(ws, peer_id)
      LOGGER.info "P2P: peer #{peer_id} connected"
    end

    def handle_message(ws, peer_id, raw)
      msg = Oj.load(raw, mode: :compat)
      case msg["type"]
      when "join"   then join_room(ws, peer_id, msg["room"])
      when "offer"  then relay(ws, peer_id, msg, "offer",  %w[sdp])
      when "answer" then relay(ws, peer_id, msg, "answer", %w[sdp])
      when "ice"    then relay(ws, peer_id, msg, "ice",    %w[candidate])
      when "leave"  then leave_room(ws, peer_id)
      else               send_to(ws, { type: "error", message: "unknown message type" })
      end
    rescue Oj::ParseError
      send_to(ws, { type: "error", message: "invalid JSON" })
    end

    def handle_close(ws, peer_id)
      leave_room(ws, peer_id)
      LOGGER.info "P2P: peer #{peer_id} disconnected"
    end

    def join_room(ws, peer_id, room_id)
      return send_to(ws, { type: "error", message: "room is required" }) unless room_id

      synchronize do
        @rooms[room_id] ||= {}
        existing_peers = @rooms[room_id].keys.dup
        @rooms[room_id][peer_id] = ws
        @peers[ws] = { peer_id: peer_id, room_id: room_id }

        broadcast_to_room(room_id, { type: "peer_joined", peer_id: peer_id }, exclude: peer_id)
        send_to(ws, { type: "joined", peer_id: peer_id, peers: existing_peers })
      end

      LOGGER.info "P2P: peer #{peer_id} joined room #{room_id}"
    end

    def leave_room(ws, peer_id)
      info = synchronize { @peers.delete(ws) }
      return unless info

      room_id = info[:room_id]
      synchronize do
        @rooms[room_id]&.delete(peer_id)
        @rooms.delete(room_id) if @rooms[room_id]&.empty?
      end

      broadcast_to_room(room_id, { type: "peer_left", peer_id: peer_id })
    end

    def relay(src_ws, src_peer_id, msg, type, required_fields)
      to_peer_id = msg["to"]
      return send_to(src_ws, { type: "error", message: "'to' is required" }) unless to_peer_id

      info, dest_ws = synchronize do
        i = @peers[src_ws]
        dw = i && @rooms.dig(i[:room_id], to_peer_id)
        [i, dw]
      end

      return send_to(src_ws, { type: "error", message: "not in a room" }) unless info
      return send_to(src_ws, { type: "error", message: "peer not found" }) unless dest_ws

      payload = { type: type, from: src_peer_id }
      required_fields.each { |f| payload[f] = msg[f] }
      send_to(dest_ws, payload)
    end

    def broadcast_to_room(room_id, payload, exclude: nil)
      room = synchronize { @rooms[room_id]&.dup || {} }
      room.each do |peer_id, ws|
        next if peer_id == exclude

        send_to(ws, payload)
      end
    end

    def send_to(ws, payload)
      ws.send(Oj.dump(payload, mode: :compat))
    rescue StandardError => e
      LOGGER.warn "P2P send error: #{e.message}"
    end
  end
end
