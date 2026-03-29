# frozen_string_literal: true

require "sequel"
require "sequel/extensions/migration"
require "logger"

# DB is the application-wide Sequel connection.
# It is adapter-agnostic: the adapter is inferred from the DATABASE_URL scheme.
#   sqlite://  → SQLite3
#   postgres:// → PostgreSQL
#
# Usage:
#   DB.connect!          # called once at boot
#   DB.connection        # returns the Sequel::Database instance
#   DB.migrate!          # run all pending core migrations
module DB
  MIGRATIONS_DIR = File.expand_path("../../db/migrations", __FILE__)

  class << self
    attr_reader :connection

    def connect!
      url = AppConfig.get(:database, :url)
      @connection = Sequel.connect(url, logger: build_logger)
      Sequel::Model.db = @connection
      configure_pragmas! if sqlite?
      self
    end

    def migrate!(dir = MIGRATIONS_DIR, target: nil)
      Sequel::Migrator.run(@connection, dir, target: target)
    end

    # Run a block inside a transaction; used by plugin schema loader.
    def transaction(&block)
      @connection.transaction(&block)
    end

    def sqlite?
      @connection.adapter_scheme.to_s.start_with?("sqlite")
    end

    def postgres?
      @connection.adapter_scheme.to_s.start_with?("postgres")
    end

    private

    def build_logger
      AppLogger.logger
    end

    def configure_pragmas!
      @connection.run("PRAGMA journal_mode=WAL")
      @connection.run("PRAGMA foreign_keys=ON")
    end
  end
end
