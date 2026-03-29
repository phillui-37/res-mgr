# frozen_string_literal: true

require "logger"

module PluginLoader
  # Loads code-based plugins from the configured plugins directory.
  # Each plugin lives in its own subdirectory:
  #
  #   plugins/
  #     ebook/
  #       plugin.rb   ← must define a class ending in Plugin that subclasses BasePlugin
  #     music/
  #       plugin.rb
  #
  # The file is required in an isolated binding; the top-level constant is resolved
  # after require so that namespacing is not required.
  module File
    LOGGER = AppLogger.logger

    class << self
      def load_all!
        dir = AppConfig.get(:plugins, :dir)
        return unless dir && ::File.directory?(dir)

        Dir.glob(::File.join(dir, "*", "plugin.rb")).sort.each do |path|
          load_file(path)
        end
      end

      # Load (or reload) a single plugin file.
      # Returns the plugin instance on success, nil on failure.
      def load_file(path)
        before_constants = Object.constants
        require ::File.expand_path(path)
        new_constants = Object.constants - before_constants

        plugin_class = new_constants
          .map { |c| Object.const_get(c) }
          .find { |c| c.is_a?(Class) && c < BasePlugin }

        unless plugin_class
          LOGGER.warn "PluginLoader::File: no BasePlugin subclass found in #{path}"
          return nil
        end

        instance = plugin_class.new
        PluginSchema.apply!(instance)
        PluginRegistry.instance.register(instance)
        LOGGER.info "Loaded plugin '#{instance.name}' v#{instance.version} from #{path}"
        instance
      rescue StandardError => e
        LOGGER.error "PluginLoader::File: failed to load #{path}: #{e.message}"
        nil
      end

      # Reload a plugin by its source path (used by the hot-reload watcher).
      def reload_file(path)
        # Re-evaluate the file; unregister old version first using name from path.
        plugin_name = ::File.basename(::File.dirname(path))
        PluginRegistry.instance.unregister(plugin_name)

        # Remove from $LOADED_FEATURES so require will re-execute the file.
        $LOADED_FEATURES.delete(::File.expand_path(path))

        load_file(path)
      end
    end
  end
end
