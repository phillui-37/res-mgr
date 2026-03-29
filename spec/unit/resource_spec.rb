# frozen_string_literal: true

require "spec_helper"

RSpec.describe Resource, type: :db do
  describe "JSON columns" do
    describe "#locations" do
      it "returns an empty array when the column is nil" do
        r = described_class.new
        expect(r.locations).to eq([])
      end

      it "round-trips an array through assignment and access" do
        r = described_class.new
        r.locations = ["/nas/books/file.epub", "/local/backup/file.epub"]
        expect(r.locations).to eq(["/nas/books/file.epub", "/local/backup/file.epub"])
      end
    end

    describe "#tags" do
      it "returns an empty array when the column is nil" do
        r = described_class.new
        expect(r.tags).to eq([])
      end

      it "round-trips an array of strings" do
        r = described_class.new
        r.tags = ["sci-fi", "favourite"]
        expect(r.tags).to eq(["sci-fi", "favourite"])
      end
    end
  end

  describe "#validate" do
    it "is valid with name, type, and plugin" do
      r = described_class.new(name: "book.epub", type: "ebook", plugin: "ebook")
      expect(r.valid?).to be true
    end

    it "is invalid without a name" do
      r = described_class.new(type: "ebook", plugin: "ebook")
      expect(r.valid?).to be false
      expect(r.errors[:name]).not_to be_empty
    end

    it "is invalid with a blank name" do
      r = described_class.new(name: "   ", type: "ebook", plugin: "ebook")
      expect(r.valid?).to be false
    end

    it "is invalid without a type" do
      r = described_class.new(name: "book.epub", plugin: "ebook")
      expect(r.valid?).to be false
      expect(r.errors[:type]).not_to be_empty
    end

    it "is invalid without a plugin" do
      r = described_class.new(name: "book.epub", type: "ebook")
      expect(r.valid?).to be false
      expect(r.errors[:plugin]).not_to be_empty
    end
  end

  describe "#to_api_h" do
    let(:resource) do
      r = described_class.new(name: "film.mkv", type: "video", plugin: "video")
      r.locations = ["/nas/video/film.mkv"]
      r.tags      = ["action"]
      r.save
      r
    end

    subject(:api_hash) { resource.to_api_h }

    it "includes all required keys" do
      expect(api_hash.keys).to contain_exactly(
        :id, :name, :type, :plugin, :locations, :tags, :checksum, :active,
        :created_at, :updated_at
      )
    end

    it "returns the decoded locations array" do
      expect(api_hash[:locations]).to eq(["/nas/video/film.mkv"])
    end

    it "returns the decoded tags array" do
      expect(api_hash[:tags]).to eq(["action"])
    end

    it "returns an ISO8601 timestamp for created_at" do
      expect(api_hash[:created_at]).to match(/\d{4}-\d{2}-\d{2}T/)
    end

    it "returns nil checksum when not set" do
      expect(api_hash[:checksum]).to be_nil
    end
  end

  describe "persistence" do
    it "saves and retrieves a resource by id" do
      r = described_class.new(name: "track.mp3", type: "music", plugin: "music")
      r.save
      fetched = described_class[r.id]
      expect(fetched.name).to eq("track.mp3")
    end

    it "defaults active to true" do
      r = described_class.new(name: "n.mp3", type: "music", plugin: "music")
      r.save
      expect(described_class[r.id].active).to be true
    end
  end
end
