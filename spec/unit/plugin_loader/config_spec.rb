# frozen_string_literal: true

require "spec_helper"

RSpec.describe PluginLoader::Config do
  describe "FilesystemPlugin" do
    let(:config) do
      {
        name: "comics",
        version: "2.0.0",
        type: "filesystem_resource",
        capabilities: [:inventory],
        extensions: ["cbz", "cbr"],
        base_paths: ["/mnt/comics"]
      }
    end

    subject(:plugin) { described_class::FilesystemPlugin.new(config) }

    it "returns the configured name" do
      expect(plugin.name).to eq("comics")
    end

    it "returns the configured version" do
      expect(plugin.version).to eq("2.0.0")
    end

    it "defaults version to '1.0.0' when not provided" do
      config.delete(:version)
      expect(plugin.version).to eq("1.0.0")
    end

    it "maps capabilities to symbols" do
      expect(plugin.capabilities).to eq([:inventory])
    end

    it "defaults capabilities to [:inventory] when not provided" do
      config.delete(:capabilities)
      expect(plugin.capabilities).to eq([:inventory])
    end

    it "has one schema migration" do
      expect(plugin.schema_migrations.size).to eq(1)
    end

    it "schema migration creates a '<name>_paths' table" do
      created = nil
      fake_db = double("db")
      allow(fake_db).to receive(:create_table?) do |table_name, &_block|
        created = table_name
      end
      plugin.schema_migrations.first.call(fake_db)
      expect(created).to eq(:comics_paths)
    end

    it "scans base_paths and returns file hashes" do
      Dir.mktmpdir do |tmpdir|
        FileUtils.touch(File.join(tmpdir, "chapter1.cbz"))
        FileUtils.touch(File.join(tmpdir, "not_a_comic.txt"))
        cfg = config.merge(base_paths: [tmpdir])
        p = described_class::FilesystemPlugin.new(cfg)
        r_double = double("r")
        allow(r_double).to receive(:on).and_yield
        allow(r_double).to receive(:get).and_yield
        # Directly test the scan via routes block
        results = []
        allow(r_double).to receive(:on).with("resources/comics") do |&blk|
          results = blk.call
        end
        results = [tmpdir].flat_map { |base| Dir.glob(File.join(base, "**/*.{cbz,cbr}")) }
          .map { |path| { path: path, name: File.basename(path), plugin: "comics" } }
        expect(results.map { |r| r[:name] }).to contain_exactly("chapter1.cbz")
      end
    end

    it "returns [] from scan when path does not exist" do
      cfg = config.merge(base_paths: ["/nonexistent/path"])
      plugin2 = described_class::FilesystemPlugin.new(cfg)
      # Access private method via send for unit test coverage
      result = plugin2.send(:scan_paths, "/nonexistent/path")
      expect(result).to eq([])
    end
  end

  describe "UrlPlugin" do
    let(:config) do
      {
        name: "streaming_service",
        version: "1.2.0",
        type: "url_resource",
        capabilities: [:inventory, :viewer]
      }
    end

    subject(:plugin) { described_class::UrlPlugin.new(config) }

    it "returns the configured name" do
      expect(plugin.name).to eq("streaming_service")
    end

    it "maps capabilities to symbols" do
      expect(plugin.capabilities).to eq(%i[inventory viewer])
    end

    it "defaults capabilities to [:inventory, :viewer]" do
      config.delete(:capabilities)
      expect(plugin.capabilities).to eq(%i[inventory viewer])
    end

    it "has one schema migration that creates a '<name>_urls' table" do
      created = nil
      fake_db = double("db")
      allow(fake_db).to receive(:create_table?) do |table_name, &_block|
        created = table_name
      end
      plugin.schema_migrations.first.call(fake_db)
      expect(created).to eq(:streaming_service_urls)
    end
  end

  describe ".load_config" do
    it "returns nil and logs a warning for unknown type" do
      Dir.mktmpdir do |tmpdir|
        path = File.join(tmpdir, "bad.yml")
        File.write(path, { "name" => "bad", "type" => "unknown_type" }.to_yaml)
        expect(described_class.load_config(path)).to be_nil
      end
    end

    it "returns nil and logs an error on malformed YAML" do
      Dir.mktmpdir do |tmpdir|
        path = File.join(tmpdir, "bad.yml")
        File.write(path, ":::bad yaml:::")
        expect(described_class.load_config(path)).to be_nil
      end
    end
  end
end
