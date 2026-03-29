# frozen_string_literal: true

require "faye/websocket"
require "logger"
require "singleton"
require "set"

module Websocket
  # Hub manages all active WebSocket connections and provides
  # topic-based pub/sub for real-time event broadcasting.
  #
  # Topics are arbitrary strings (e.g. "resources", "p2p/room/abc123").
  # Clients subscribe on connect by passing ?topics=foo,bar in the URL.
  class Hub
    LOGGER = AppLogger.logger

    include Singleton
    include MonitorMixin

    def initialize
      super
      @subscriptions = Hash.new { |h, k| h[k] = [] } # topic → [ws, ...]
      @connections   = {}                               # ws → Set<topic>
    end

    # Rack call — upgrades HTTP to WebSocket if requested.
    def call(env)
      return [426, {}, ["Upgrade Required"]] unless Faye::WebSocket.websocket?(env)

      ws      = Faye::WebSocket.new(env)
      topics  = parse_topics(env["QUERY_STRING"])
      principal = env["res_mgr.principal"]

      ws.on :open do
        subscribe(ws, topics, principal)
        LOGGER.info "WS connected: #{topics.inspect} principal=#{principal&.dig('sub')}"
      end

      ws.on :message do |event|
        handle_message(ws, event.data)
      end

      ws.on :close do
        unsubscribe_all(ws)
        LOGGER.info "WS disconnected"
      end

      ws.rack_response
    end

    # Publish a payload to all subscribers of a topic.
    def publish(topic, payload)
      message = Oj.dump({ topic: topic, data: payload }, mode: :compat)
      synchronize do
        (@subscriptions[topic] || []).each do |ws|
          ws.send(message)
        rescue StandardError => e
          LOGGER.warn "WS publish error: #{e.message}"
        end
      end
    end

    private

    def subscribe(ws, topics, principal)
      synchronize do
        @connections[ws] = Set.new(topics)
        topics.each { |t| @subscriptions[t] << ws }
      end
      ws.send(Oj.dump({ type: "subscribed", topics: topics }, mode: :compat))
    end

    def unsubscribe_all(ws)
      synchronize do
        (@connections.delete(ws) || []).each do |topic|
          @subscriptions[topic].delete(ws)
          @subscriptions.delete(topic) if @subscriptions[topic].empty?
        end
      end
    end

    def handle_message(ws, data)
      msg = Oj.load(data, mode: :compat)
      # Currently clients can send ping; future: allow client→topic publish with auth.
      if msg["type"] == "ping"
        ws.send(Oj.dump({ type: "pong" }, mode: :compat))
      end
    rescue Oj::ParseError
      ws.send(Oj.dump({ type: "error", message: "invalid JSON" }, mode: :compat))
    end

    def parse_topics(query_string)
      return ["default"] if query_string.nil? || query_string.empty?

      query_string.split("&").each_with_object([]) do |part, topics|
        key, value = part.split("=", 2)
        topics.concat(value.split(",")) if key == "topics" && value
      end.uniq.tap { |t| t << "default" if t.empty? }
    end
  end
end
