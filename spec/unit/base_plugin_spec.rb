# frozen_string_literal: true

require "spec_helper"

RSpec.describe BasePlugin do
  # Minimal concrete subclass used across tests.
  let(:concrete_class) do
    Class.new(BasePlugin) do
      def name         = "test_plugin"
      def version      = "2.0.0"
      def capabilities = %i[inventory viewer]
    end
  end

  let(:plugin) { concrete_class.new }

  describe "abstract interface" do
    subject(:abstract) { described_class.new }

    it "raises NotImplementedError for #name" do
      expect { abstract.name }.to raise_error(NotImplementedError, /name/)
    end

    it "raises NotImplementedError for #version" do
      expect { abstract.version }.to raise_error(NotImplementedError, /version/)
    end

    it "raises NotImplementedError for #capabilities" do
      expect { abstract.capabilities }.to raise_error(NotImplementedError, /capabilities/)
    end
  end

  describe "default implementations" do
    it "#schema_migrations returns empty array" do
      expect(plugin.schema_migrations).to eq([])
    end

    it "#routes returns nil" do
      expect(plugin.routes(double("r"))).to be_nil
    end

    it "#on_load returns nil without raising" do
      expect { plugin.on_load }.not_to raise_error
    end

    it "#on_unload returns nil without raising" do
      expect { plugin.on_unload }.not_to raise_error
    end
  end

  describe "#to_h" do
    it "returns a hash with name, version, and capabilities" do
      expect(plugin.to_h).to eq(
        name:         "test_plugin",
        version:      "2.0.0",
        capabilities: %i[inventory viewer]
      )
    end
  end

  describe "CAPABILITIES constant" do
    it "includes the four defined capability types" do
      expect(described_class::CAPABILITIES).to contain_exactly(
        :inventory, :viewer, :progress, :stream
      )
    end
  end
end
