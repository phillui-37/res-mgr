# frozen_string_literal: true

require "logger"

# Centralized logger for the application.
# All components should use AppLogger.logger rather than creating their own Logger instances.
# Log level is read from AppConfig at first access.
module AppLogger
  class << self
    def logger
      @logger ||= build_logger
    end

    # Allow tests or boot sequence to reset (e.g., after AppConfig is loaded).
    def reset!
      @logger = nil
    end

    private

    def build_logger
      level_name = AppConfig.get(:log, :level)&.upcase || "INFO"
      Logger.new($stdout).tap do |l|
        l.level     = Logger.const_get(level_name)
        l.formatter = proc do |severity, _time, _progname, msg|
          "#{severity} #{msg}\n"
        end
      end
    end
  end
end
