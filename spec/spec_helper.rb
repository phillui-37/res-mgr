# frozen_string_literal: true

require "rack/test"
require "rack"
require "rspec"
require "oj"
require "jwt"

# Set test DB and env BEFORE loading application code.
ENV["RACK_ENV"]     = "test"
ENV["DATABASE_URL"] = "sqlite://db/test.sqlite3"
ENV["LOG_LEVEL"]    = "error"
ENV["JWT_SECRET"]   = "test-secret-key-must-be-32-chars!!"
ENV["PLUGIN_DIR"]   = "plugins"

# Boot the full application stack once for the entire suite.
require_relative "../core/boot"

require_relative "support/request_helpers"
require_relative "support/db_helpers"

RSpec.configure do |config|
  config.include Rack::Test::Methods, type: :request
  config.include RequestHelpers,      type: :request
  config.include DbHelpers,           type: :db

  config.expect_with :rspec do |expectations|
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end
  config.mock_with :rspec do |mocks|
    mocks.verify_partial_doubles = true
  end
  config.shared_context_metadata_behavior = :apply_to_host_groups

  # Wrap every :db example in a rolled-back transaction so tests don't pollute each other.
  config.around(:each, type: :db) do |example|
    DB.connection.transaction(rollback: :always, savepoint: true) { example.run }
  end

  # Also wrap :request examples in transactions to isolate DB state.
  config.around(:each, type: :request) do |example|
    DB.connection.transaction(rollback: :always, savepoint: true) { example.run }
  end

  # Clean test DB files after the full suite (SQLite WAL mode creates companion files).
  config.after(:suite) do
    DB.connection.disconnect
    db_path = File.expand_path("../db/test.sqlite3", __dir__)
    %W[#{db_path} #{db_path}-wal #{db_path}-shm].each do |f|
      File.delete(f) if File.exist?(f)
    end
  end
end
