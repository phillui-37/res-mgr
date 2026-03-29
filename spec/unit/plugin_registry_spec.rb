# frozen_string_literal: true

require "spec_helper"

RSpec.describe PluginRegistry do
  subject(:registry) { described_class.instance }

  # Helper: make a minimal plugin double that satisfies the contract.
  def make_plugin(name, caps = [:inventory])
    instance_double(BasePlugin,
                    name: name, version: "1.0.0",
                    capabilities: caps,
                    schema_migrations: [],
                    on_load: nil, on_unload: nil,
                    to_h: { name: name, version: "1.0.0", capabilities: caps })
  end

  # Save and restore the registry state around each test to avoid polluting
  # other specs that rely on the plugins loaded during boot.
  around do |example|
    original = registry.instance_variable_get(:@plugins).dup
    registry.instance_variable_set(:@plugins, {})
    example.run
  ensure
    registry.instance_variable_set(:@plugins, original)
  end

  describe "#register" do
    it "makes the plugin findable by name" do
      plugin = make_plugin("foo")
      registry.register(plugin)
      expect(registry.find("foo")).to eq(plugin)
    end

    it "calls on_load on the plugin" do
      plugin = make_plugin("foo")
      expect(plugin).to receive(:on_load)
      registry.register(plugin)
    end

    it "does NOT call PluginSchema.apply! (schema is applied by loaders, not the registry)" do
      plugin = make_plugin("foo")
      expect(PluginSchema).not_to receive(:apply!)
      registry.register(plugin)
    end

    it "raises ArgumentError when a plugin with the same name is already registered" do
      plugin_a = make_plugin("dup")
      plugin_b = make_plugin("dup")
      registry.register(plugin_a)
      expect { registry.register(plugin_b) }.to raise_error(ArgumentError, /already registered/)
    end

    it "raises ArgumentError when the plugin name contains uppercase letters" do
      plugin = make_plugin("MyPlugin")
      expect { registry.register(plugin) }.to raise_error(ArgumentError, /snake_case/)
    end

    it "raises ArgumentError when the plugin name is empty" do
      plugin = make_plugin("")
      expect { registry.register(plugin) }.to raise_error(ArgumentError, /snake_case/)
    end

    it "raises ArgumentError when capabilities include an unknown symbol" do
      plugin = make_plugin("bad_caps", %i[inventory flying])
      expect { registry.register(plugin) }.to raise_error(ArgumentError, /unknown capabilities/)
    end

    it "accepts plugins with all valid capabilities" do
      plugin = make_plugin("full_caps", %i[inventory viewer progress stream])
      expect { registry.register(plugin) }.not_to raise_error
    end
  end

  describe "#unregister" do
    it "calls on_unload and removes the plugin" do
      plugin = make_plugin("bye")
      registry.register(plugin)
      expect(plugin).to receive(:on_unload)
      registry.unregister("bye")
      expect(registry.find("bye")).to be_nil
    end

    it "is a no-op when plugin does not exist" do
      expect { registry.unregister("ghost") }.not_to raise_error
    end
  end

  describe "#reload" do
    it "replaces the old plugin with a new instance" do
      old_plugin = make_plugin("replace")
      new_plugin = make_plugin("replace")
      registry.register(old_plugin)
      registry.reload("replace", new_plugin)
      expect(registry.find("replace")).to eq(new_plugin)
    end
  end

  describe "#all" do
    it "returns all registered plugins" do
      a = make_plugin("a")
      b = make_plugin("b")
      registry.register(a)
      registry.register(b)
      expect(registry.all).to contain_exactly(a, b)
    end

    it "returns a copy that does not expose internal state" do
      a = make_plugin("a")
      registry.register(a)
      registry.all.clear
      expect(registry.all).not_to be_empty
    end
  end

  describe "#names" do
    it "returns the registered plugin names" do
      registry.register(make_plugin("x"))
      registry.register(make_plugin("y"))
      expect(registry.names).to contain_exactly("x", "y")
    end
  end

  describe "#each" do
    it "iterates over all plugins" do
      registry.register(make_plugin("a"))
      registry.register(make_plugin("b"))
      collected = []
      registry.each { |p| collected << p.name }
      expect(collected).to contain_exactly("a", "b")
    end
  end
end
