# frozen_string_literal: true

require "spec_helper"
require "tmpdir"
require "yaml"

RSpec.describe AppConfig do
  describe ".load!" do
    it "loads YAML and symbolizes keys" do
      Dir.mktmpdir do |dir|
        file = File.join(dir, "app.yml")
        File.write(file, { "server" => { "port" => 4567 } }.to_yaml)

        AppConfig.load!(file)
        expect(AppConfig.get(:server, :port)).to eq(4567)
      end
    end

    it "deep-symbolizes nested keys" do
      original = ENV["JWT_SECRET"]
      ENV.delete("JWT_SECRET")
      Dir.mktmpdir do |dir|
        file = File.join(dir, "app.yml")
        File.write(file, { "auth" => { "jwt_secret" => "abc" } }.to_yaml)

        AppConfig.load!(file)
        expect(AppConfig[:auth][:jwt_secret]).to eq("abc")
      end
    ensure
      ENV["JWT_SECRET"] = original
      AppConfig.load!
    end

    it "applies ENV overrides after loading YAML" do
      Dir.mktmpdir do |dir|
        file = File.join(dir, "app.yml")
        File.write(file, { "server" => { "port" => 3000 } }.to_yaml)

        original = ENV["APP_PORT"]
        ENV["APP_PORT"] = "9999"
        AppConfig.load!(file)
        expect(AppConfig.get(:server, :port)).to eq(9_999)
      ensure
        ENV["APP_PORT"] = original
        # Restore real config
        AppConfig.load!
      end
    end

    it "coerces APP_PORT to Integer" do
      Dir.mktmpdir do |dir|
        file = File.join(dir, "app.yml")
        File.write(file, { "server" => {} }.to_yaml)

        original = ENV["APP_PORT"]
        ENV["APP_PORT"] = "8080"
        AppConfig.load!(file)
        expect(AppConfig.get(:server, :port)).to be_a(Integer)
      ensure
        ENV["APP_PORT"] = original
        AppConfig.load!
      end
    end

    it "ignores empty ENV vars" do
      Dir.mktmpdir do |dir|
        file = File.join(dir, "app.yml")
        File.write(file, { "server" => { "host" => "localhost" } }.to_yaml)

        original = ENV["APP_HOST"]
        ENV["APP_HOST"] = ""
        AppConfig.load!(file)
        expect(AppConfig.get(:server, :host)).to eq("localhost")
      ensure
        ENV["APP_HOST"] = original
        AppConfig.load!
      end
    end
  end

  describe ".get" do
    before { AppConfig.load! }

    it "returns nested value by key path" do
      expect(AppConfig.get(:auth, :jwt_secret)).to eq("test-secret-key-must-be-32-chars!!")
    end

    it "returns nil for missing nested key" do
      expect(AppConfig.get(:nonexistent, :key)).to be_nil
    end
  end

  describe ".[]" do
    before { AppConfig.load! }

    it "returns top-level hash by symbol key" do
      expect(AppConfig[:auth]).to be_a(Hash)
    end

    it "accepts string key coerced to symbol" do
      expect(AppConfig["auth"]).to be_a(Hash)
    end
  end

  describe ".to_h" do
    before { AppConfig.load! }

    it "returns the full config as a Hash" do
      expect(AppConfig.to_h).to be_a(Hash)
      expect(AppConfig.to_h.keys).to all(be_a(Symbol))
    end
  end
end
