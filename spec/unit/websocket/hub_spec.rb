# frozen_string_literal: true

require "spec_helper"

RSpec.describe Websocket::Hub do
  subject(:hub) { described_class.instance }

  # Reset Hub state around each test to avoid cross-test pollution.
  around do |example|
    orig_subs  = hub.instance_variable_get(:@subscriptions).dup
    orig_conns = hub.instance_variable_get(:@connections).dup
    hub.instance_variable_set(:@subscriptions, Hash.new { |h, k| h[k] = [] })
    hub.instance_variable_set(:@connections, {})
    example.run
  ensure
    hub.instance_variable_set(:@subscriptions, orig_subs)
    hub.instance_variable_set(:@connections, orig_conns)
  end

  describe "singleton" do
    it "returns the same instance each time" do
      expect(described_class.instance).to be(hub)
    end
  end

  describe "#publish" do
    it "sends the serialized payload to all topic subscribers" do
      ws = double("ws")
      # Directly inject a subscription
      hub.instance_variable_get(:@subscriptions)["events"] << ws

      expect(ws).to receive(:send) do |msg|
        parsed = Oj.load(msg, mode: :compat)
        expect(parsed["topic"]).to eq("events")
        expect(parsed["data"]["foo"]).to eq("bar")
      end

      hub.publish("events", { "foo" => "bar" })
    end

    it "does not raise when there are no subscribers for a topic" do
      expect { hub.publish("empty_topic", { "x" => 1 }) }.not_to raise_error
    end

    it "logs and continues when a subscriber raises on send" do
      ws = double("ws")
      allow(ws).to receive(:send).and_raise(StandardError, "broken pipe")
      hub.instance_variable_get(:@subscriptions)["noisy"] << ws

      expect { hub.publish("noisy", {}) }.not_to raise_error
    end
  end

  describe "#call (non-WebSocket request)" do
    it "returns 426 Upgrade Required for non-WS requests" do
      env = Rack::MockRequest.env_for("/ws")
      allow(Faye::WebSocket).to receive(:websocket?).with(env).and_return(false)
      status, = hub.call(env)
      expect(status).to eq(426)
    end
  end

  describe "parse_topics (private)" do
    def parse(qs)
      hub.send(:parse_topics, qs)
    end

    it "returns ['default'] for nil query string" do
      expect(parse(nil)).to eq(["default"])
    end

    it "returns ['default'] for empty query string" do
      expect(parse("")).to eq(["default"])
    end

    it "parses a single topic" do
      expect(parse("topics=resources")).to include("resources")
    end

    it "parses multiple comma-separated topics" do
      topics = parse("topics=resources,p2p")
      expect(topics).to include("resources", "p2p")
    end

    it "does NOT append 'default' when explicit topics are provided" do
      topics = parse("topics=foo")
      expect(topics).to include("foo")
      expect(topics).not_to include("default")
    end

    it "does not duplicate 'default'" do
      topics = parse("topics=default")
      expect(topics.count("default")).to eq(1)
    end

    it "ignores unrelated query parameters" do
      topics = parse("token=abc&topics=events")
      expect(topics).to include("events")
      expect(topics).not_to include("token")
      expect(topics).not_to include("abc")
    end
  end
end
