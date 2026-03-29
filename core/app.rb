# frozen_string_literal: true

require "roda"
require "oj"

module Core
  class App < Roda
    plugin :json, serializer: ->(obj) { Oj.dump(obj, mode: :compat) }
    plugin :json_parser, parser: ->(body) { Oj.load(body, mode: :compat) }
    plugin :all_verbs
    plugin :halt
    plugin :request_headers

    # Pre-built WebSocket auth stacks (created once at class load time).
    WS_HUB = Websocket::Auth.new(Websocket::Hub.instance)
    WS_P2P = Websocket::Auth.new(Websocket::P2PSignaling.instance)

    route do |r|
      # ── Health ─────────────────────────────────────────────────────────────
      r.on "health" do
        r.get { HealthController.status }
      end

      # ── WebSocket upgrade endpoint ──────────────────────────────────────────
      # /ws          → pub/sub hub (general events)
      # /ws/p2p      → WebRTC signaling
      r.on "ws" do
        unless Faye::WebSocket.websocket?(env)
          r.halt(426, "WebSocket upgrade required")
        end

        r.on("p2p") { throw :halt, WS_P2P.call(env) }
        throw :halt, WS_HUB.call(env)
      end

      # ── Plugin management ───────────────────────────────────────────────────
      r.on "plugins" do
        PluginController.call(r)
      end

      # ── P2P room management (REST) ──────────────────────────────────────────
      r.on "p2p" do
        P2PController.call(r)
      end

      # ── Plugin-specific resource routes ────────────────────────────────────
      # Must come BEFORE the generic /resources route so plugin paths like
      # /resources/ebook are not consumed by the generic handler first.
      PluginRegistry.instance.each { |plugin| plugin.routes(r) }

      # ── Generic resource inventory ──────────────────────────────────────────
      r.on "resources" do
        ResourceController.call(r)
      end
    end
  end
end
