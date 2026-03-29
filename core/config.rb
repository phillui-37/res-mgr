# frozen_string_literal: true

require "yaml"

# Loads config/app.yml and allows env-var overrides.
# Access via AppConfig[:server][:port] or AppConfig.get(:server, :port).
class AppConfig
  CONFIG_FILE = File.expand_path("../../config/app.yml", __FILE__)

  ENV_OVERRIDES = {
    %i[server port]           => ->(v) { v.to_i },
    %i[server host]           => nil,
    %i[database url]          => nil,
    %i[plugins dir]           => nil,
    %i[plugins config_dir]    => nil,
    %i[auth jwt_secret]       => nil,
    %i[auth token_expiry_seconds] => ->(v) { v.to_i },
    %i[log level]             => nil
  }.freeze

  ENV_VAR_MAP = {
    %i[server port]               => "APP_PORT",
    %i[server host]               => "APP_HOST",
    %i[database url]              => "DATABASE_URL",
    %i[plugins dir]               => "PLUGIN_DIR",
    %i[plugins config_dir]        => "PLUGIN_CONFIG_DIR",
    %i[auth jwt_secret]           => "JWT_SECRET",
    %i[auth token_expiry_seconds] => "JWT_EXPIRY_SECONDS",
    %i[log level]                 => "LOG_LEVEL"
  }.freeze

  @data = {}

  class << self
    def load!(file = CONFIG_FILE)
      raw = YAML.safe_load(File.read(file), symbolize_names: true)
      @data = deep_symbolize(raw)
      apply_env_overrides!
      self
    end

    def [](key)
      @data[key.to_sym]
    end

    def get(*keys)
      keys.map(&:to_sym).reduce(@data) { |hash, k| hash&.dig(k) }
    end

    def to_h
      @data
    end

    private

    def apply_env_overrides!
      ENV_VAR_MAP.each do |key_path, env_var|
        value = ENV[env_var]
        next if value.nil? || value.empty?

        coerce = ENV_OVERRIDES[key_path]
        value  = coerce.call(value) if coerce
        set_nested!(@data, key_path, value)
      end
    end

    def set_nested!(hash, keys, value)
      *parents, last = keys
      node = parents.reduce(hash) { |h, k| h[k] ||= {} }
      node[last] = value
    end

    def deep_symbolize(obj)
      case obj
      when Hash  then obj.transform_keys(&:to_sym).transform_values { |v| deep_symbolize(v) }
      when Array then obj.map { |v| deep_symbolize(v) }
      else obj
      end
    end
  end
end
