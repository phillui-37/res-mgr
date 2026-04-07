# frozen_string_literal: true

# Shared boot sequence used by config.ru and test helpers.
# Does NOT call `run` — that's the Rack entry point's responsibility.

require_relative "config"
AppConfig.load!

# Guard against insecure JWT secret in non-test environments.
unless ENV["RACK_ENV"] == "test"
  secret = AppConfig.get(:auth, :jwt_secret).to_s
  if secret == "changeme" || secret.length < 32
    raise "FATAL: JWT secret is insecure. Set JWT_SECRET env var to a random 32+ character string."
  end
end

require_relative "app_logger"
require_relative "db"
DB.connect!
DB.migrate!

require_relative "base_plugin"
require_relative "plugin_schema"
require_relative "plugin_registry"
require_relative "plugin_loader"
require_relative "plugin_hot_reload"

require_relative "authenticator"
require_relative "controller_helpers"
require_relative "request_logger"
require_relative "auth_middleware"
require_relative "websocket/hub"
require_relative "websocket/auth"
require_relative "websocket/p2p_signaling"

require_relative "health_controller"
require_relative "plugin_controller"
require_relative "inventory/resource"
require_relative "inventory/resource_controller"
require_relative "inventory/device"
require_relative "inventory/device_controller"
require_relative "inventory/series_controller"
require_relative "p2p_controller"

require_relative "app"

PluginRegistry.instance.boot!
PluginHotReload.new.start!
