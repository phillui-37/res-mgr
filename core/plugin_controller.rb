# frozen_string_literal: true

# Handles plugin management REST endpoints:
#   GET  /plugins          → list all loaded plugins
#   GET  /plugins/:name    → get a single plugin
#   POST /plugins/:name/reload → reload plugin from disk (file-based only)
class PluginController
  extend ControllerHelpers

  class << self
    def call(r)
      # r.on String must come before r.get { list } so the always-matcher
      # for GET does not consume requests intended for deeper routes.
      r.on String do |name|
        r.is do
          r.get { show(name) }
        end
        r.post("reload") { reload(name, r) }
      end

      r.get { list }
    end

    private

    def list
      PluginRegistry.instance.all.map(&:to_h)
    end

    def show(name)
      plugin = PluginRegistry.instance.find(name)
      halt!(404, "Plugin '#{name}' not found") unless plugin
      plugin.to_h
    end

    def reload(name, r)
      plugin = PluginRegistry.instance.find(name)
      halt!(404, "Plugin '#{name}' not found") unless plugin

      dir  = AppConfig.get(:plugins, :dir)
      path = ::File.join(dir, name, "plugin.rb")
      halt!(422, "Plugin '#{name}' is config-based and cannot be reloaded via this endpoint") \
        unless ::File.exist?(path)

      result = PluginLoader::File.reload_file(path)
      halt!(500, "Reload failed — check server logs") unless result

      { reloaded: name, version: result.version }
    end
  end
end
