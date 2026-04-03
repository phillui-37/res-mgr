# frozen_string_literal: true

threads 1, 5
bind "tcp://#{ENV.fetch('APP_HOST', '0.0.0.0')}:#{ENV.fetch('APP_PORT', 3000)}"
workers ENV.fetch("WEB_CONCURRENCY", 0).to_i
preload_app!
