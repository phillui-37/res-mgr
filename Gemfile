# frozen_string_literal: true
# Managed by gel (https://gel.dev). Use `gel install` instead of `bundle install`.

source "https://rubygems.org"

ruby "4.0.2"

# HTTP
gem "roda", "~> 3.85"
gem "puma", "~> 6.4"
gem "rack-cors", "~> 2.0"

# DB
gem "sequel", "~> 5.86"
gem "sqlite3", "~> 2.1"
gem "pg", "~> 1.5"

# WebSocket
gem "faye-websocket", "~> 0.11"
gem "eventmachine", "~> 1.2"

# Auth
gem "jwt", "~> 2.9"
# bcrypt: reserved for future API key hashing (api_keys currently stored as plaintext in config)

# Config & utilities
gem "listen", "~> 3.9"
gem "oj", "~> 3.16"

group :development, :test do
  gem "rubocop", "~> 1.70", require: false
  gem "rubocop-sequel", "~> 0.3", require: false
  gem "rspec", "~> 3.13"
  gem "rack-test", "~> 2.1"
end
