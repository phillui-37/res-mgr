# frozen_string_literal: true

require "yaml"
require "logger"

module PluginLoader
  # Loads config-based plugins from YAML files in config/plugins/.
  #
  # Supported rule types (type: field):
  #   filesystem_resource  — a resource backed by local filesystem paths
  #   url_resource         — a resource backed by remote URLs (online providers)
  #
  # Example YAML (config/plugins/manga.yml):
  #
  #   name: manga
  #   version: "1.0.0"
  #   type: filesystem_resource
  #   capabilities:
  #     - inventory
  #   extensions:
  #     - cbz
  #     - cbr
  #     - pdf
  #   base_paths:
  #     - /mnt/nas/manga
  #
  module Config
    LOGGER = AppLogger.logger

    RULE_TYPES = %w[filesystem_resource url_resource tagger].freeze

    class << self
      def load_all!
        dir = AppConfig.get(:plugins, :config_dir)
        return unless dir && ::File.directory?(dir)

        Dir.glob(::File.join(dir, "*.yml")).sort.each do |path|
          load_config(path)
        end
      end

      def load_config(path)
        raw = YAML.safe_load(::File.read(path), symbolize_names: true)
        plugin = build_plugin(raw, path)
        return unless plugin

        PluginSchema.apply!(plugin)
        PluginRegistry.instance.register(plugin)
        LOGGER.info "Loaded config plugin '#{plugin.name}' from #{path}"
        plugin
      rescue StandardError => e
        LOGGER.error "PluginLoader::Config: failed to load #{path}: #{e.message}"
        nil
      end

      private

      def build_plugin(config, path)
        type = config[:type]&.to_s
        unless RULE_TYPES.include?(type)
          LOGGER.warn "PluginLoader::Config: unknown type '#{type}' in #{path}"
          return nil
        end

        case type
        when "filesystem_resource" then FilesystemPlugin.new(config)
        when "url_resource"        then UrlPlugin.new(config)
        when "tagger"              then TaggerPlugin.new(config)
        end
      end
    end

    # ------------------------------------------------------------------
    # Config-derived plugin: filesystem_resource
    # ------------------------------------------------------------------
    class FilesystemPlugin < BasePlugin
      def initialize(config)
        @config = config
      end

      def name      = @config[:name].to_s
      def version   = @config[:version]&.to_s || "1.0.0"

      def capabilities
        (@config[:capabilities] || [:inventory]).map(&:to_sym)
      end

      def schema_migrations
        plugin_name = name
        [
          lambda do |db|
            db.create_table?(:"#{plugin_name}_paths") do
              primary_key :id
              String :path,       null: false
              String :extension,  null: false
              TrueClass :active,  default: true
              DateTime :created_at, default: Sequel::CURRENT_TIMESTAMP
            end
          end
        ]
      end

      def routes(r)
        r.on "resources/#{name}" do
          r.get { cached_scan }
        end
      end

      private

      def base_paths = Array(@config[:base_paths])
      def extensions = Array(@config[:extensions]).map { |e| e.to_s.sub(/^\./, "") }

      def scan_paths(base)
        ext_pattern = "{#{extensions.join(",")}}"
        Dir.glob(::File.join(base, "**", "*.#{ext_pattern}")).map do |path|
          { path: path, name: ::File.basename(path), plugin: name }
        end
      rescue Errno::ENOENT
        []
      end

      def scan_cache_expired?
        @scan_cache_at.nil? || (Process.clock_gettime(Process::CLOCK_MONOTONIC) - @scan_cache_at) > 30
      end

      def cached_scan
        if scan_cache_expired?
          @scan_cache    = base_paths.flat_map { |base| scan_paths(base) }
          @scan_cache_at = Process.clock_gettime(Process::CLOCK_MONOTONIC)
        end
        @scan_cache
      end
    end

    # ------------------------------------------------------------------
    # Config-derived plugin: url_resource
    # ------------------------------------------------------------------
    class UrlPlugin < BasePlugin
      def initialize(config)
        @config = config
      end

      def name      = @config[:name].to_s
      def version   = @config[:version]&.to_s || "1.0.0"

      def capabilities
        (@config[:capabilities] || %i[inventory viewer]).map(&:to_sym)
      end

      def schema_migrations
        plugin_name = name
        [
          lambda do |db|
            db.create_table?(:"#{plugin_name}_urls") do
              primary_key :id
              String :url,           null: false, unique: true
              String :title
              String :provider
              String :auth_token
              TrueClass :active,     default: true
              DateTime :created_at,  default: Sequel::CURRENT_TIMESTAMP
            end
          end
        ]
      end

      def routes(r)
        r.on "resources/#{name}" do
          r.get do
            DB.connection[:"#{name}_urls"].where(active: true).all
          end
        end
      end
    end
    # ------------------------------------------------------------------
    # Config-derived plugin: tagger
    #
    # A pure service plugin driven entirely by YAML rules — no DB table,
    # no routes.  Rules are a list of {pattern, tag, plugin?} entries:
    #
    #   rules:
    #     - pattern: '[RV]J\d{6,}'
    #       tag: DLSite
    #     - pattern: 'BJ\d{6,}'
    #       tag: DLSite
    #       plugin: ebook   # optional: restrict to one content plugin
    #
    # ------------------------------------------------------------------
    class TaggerPlugin < BasePlugin
      def initialize(config)
        @config = config
        @rules  = Array(config[:rules]).map do |r|
          { pattern: r[:pattern].to_s, tag: r[:tag].to_s, plugin: r[:plugin]&.to_s }
        end
      end

      def name         = @config[:name].to_s
      def version      = @config[:version]&.to_s || "1.0.0"
      def capabilities = [:tagging]
      def taggable?    = false

      # Apply all rules to the resource; return true if any new tags were added.
      def run!(resource)
        existing = Array(resource.tags)
        new_tags = @rules.each_with_object([]) do |rule, acc|
          next if rule[:plugin] && rule[:plugin] != resource.plugin.to_s
          acc << rule[:tag] if resource.name.match?(Regexp.new(rule[:pattern]))
        rescue RegexpError
          # skip malformed patterns silently
        end

        added = new_tags - existing
        return false if added.empty?

        resource.set(tags: existing + added)
        resource.save_changes
        true
      end
    end
  end
end
