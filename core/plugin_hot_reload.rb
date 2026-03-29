# frozen_string_literal: true

require "listen"
require "logger"

# Watches the plugins directory for .rb file changes and reloads affected plugins.
# Running in-flight WebSocket connections are NOT dropped: the old plugin instance
# continues serving its WS sessions until they close; new requests use the reload.
class PluginHotReload
  LOGGER = AppLogger.logger

  def initialize
    @dir = AppConfig.get(:plugins, :dir)
  end

  def start!
    return unless @dir && ::File.directory?(@dir)

    @listener = Listen.to(@dir, only: /plugin\.rb$/) do |modified, added, _removed|
      (modified + added).each { |path| handle_change(path) }
    end

    @listener.start
    LOGGER.info "PluginHotReload: watching #{@dir}"
  end

  def stop!
    @listener&.stop
  end

  private

  def handle_change(path)
    LOGGER.info "PluginHotReload: detected change in #{path}"
    PluginLoader::File.reload_file(path)
  rescue StandardError => e
    LOGGER.error "PluginHotReload: reload failed for #{path}: #{e.message}"
  end
end
