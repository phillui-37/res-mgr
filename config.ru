# frozen_string_literal: true

require_relative "core/boot"
require "rack/cors"

use Rack::Cors do
  allow do
    origins "*"
    resource "*", headers: :any, methods: %i[get post put patch delete options],
                  expose: %w[X-Total-Count X-Page X-Per-Page]
  end
end

use RequestLogger
use AuthMiddleware

run Core::App.app
