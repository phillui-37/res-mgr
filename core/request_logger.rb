# frozen_string_literal: true

require "logger"

# Rack middleware that logs each request: method, path, status, duration.
class RequestLogger
  def initialize(app)
    @app    = app
    @logger = AppLogger.logger
    @logger.level = Logger.const_get(AppConfig.get(:log, :level).upcase)
  end

  def call(env)
    start  = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    status, headers, body = @app.call(env)
    elapsed_ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start) * 1000).round(2)

    @logger.info format(
      "%s %s → %d (%.2fms)",
      env["REQUEST_METHOD"],
      env["PATH_INFO"],
      status,
      elapsed_ms
    )

    [status, headers, body]
  end
end
