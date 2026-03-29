# frozen_string_literal: true

# Returns server health and component status.
class HealthController
  class << self
    def status
      {
        status:   overall_status,
        database: db_status,
        plugins:  plugin_status,
        uptime:   uptime_seconds
      }
    end

    private

    def overall_status
      db_status[:ok] ? "ok" : "degraded"
    end

    def db_status
      DB.connection.test_connection
      { ok: true, adapter: DB.connection.adapter_scheme }
    rescue StandardError => e
      { ok: false, error: e.message }
    end

    def plugin_status
      plugins = PluginRegistry.instance.all
      {
        count:   plugins.size,
        plugins: plugins.map(&:to_h)
      }
    end

    def uptime_seconds
      (Process.clock_gettime(Process::CLOCK_MONOTONIC) - @boot_time).round(2)
    end

    def boot_time!
      @boot_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    end
  end

  boot_time!
end
