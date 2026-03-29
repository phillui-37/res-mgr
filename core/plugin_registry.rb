# frozen_string_literal: true

require "singleton"
require "monitor"

# Thread-safe registry for all loaded plugins.
# Plugins are keyed by their #name string.
class PluginRegistry
  include Singleton
  include MonitorMixin

  def initialize
    super
    @plugins = {}
  end

  # Boot: load file-based plugins and config-based plugins.
  def boot!
    PluginLoader::File.load_all!
    PluginLoader::Config.load_all!
  end

  # Register a plugin instance. Raises if a plugin with the same name is already loaded.
  # Note: schema migrations are applied by plugin loaders BEFORE calling register,
  # keeping the registry free of schema concerns.
  def register(plugin)
    synchronize do
      name = plugin.name
      raise ArgumentError, "Plugin name must be a non-empty snake_case string" \
        unless name.is_a?(String) && name.match?(/\A[a-z][a-z0-9_]*\z/)
      raise ArgumentError, "Plugin '#{name}' is already registered" if @plugins.key?(name)

      invalid_caps = Array(plugin.capabilities).map(&:to_sym) - BasePlugin::CAPABILITIES
      raise ArgumentError, "Plugin '#{name}' declares unknown capabilities: #{invalid_caps}" \
        unless invalid_caps.empty?

      plugin.on_load
      @plugins[name] = plugin
    end
  end

  # Unload and deregister a plugin by name. No-op if not found.
  def unregister(name)
    synchronize do
      plugin = @plugins.delete(name.to_s)
      return unless plugin

      plugin.on_unload
      PluginSchema.rollback!(plugin)
    end
  end

  # Reload a plugin: unregister then re-register the new instance.
  def reload(name, new_plugin_instance)
    synchronize do
      unregister(name)
      register(new_plugin_instance)
    end
  end

  def find(name)
    synchronize { @plugins[name.to_s] }
  end

  def all
    synchronize { @plugins.values.dup }
  end

  def each(&block)
    all.each(&block)
  end

  def names
    synchronize { @plugins.keys.dup }
  end
end
