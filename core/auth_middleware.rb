# frozen_string_literal: true

require_relative "authenticator"

# Rack middleware that validates a JWT (or API key) on every request.
# Skips /health and WebSocket upgrade requests.
#
# Clients pass the token in the Authorization header:
#   Authorization: Bearer <token>
#
# API keys are accepted via the X-API-Key header (useful for machine clients).
# API keys are stored in config/app.yml under auth.api_keys as an array of strings.
class AuthMiddleware
  include Authenticator

  SKIP_PATHS = %w[/health /status].freeze

  def initialize(app)
    @app = app
  end

  def call(env)
    return @app.call(env) if skip?(env)

    principal = authenticate(env)
    return unauthorized unless principal

    env["res_mgr.principal"] = principal
    @app.call(env)
  end

  private

  def skip?(env)
    SKIP_PATHS.include?(env["PATH_INFO"]) ||
      env["HTTP_UPGRADE"]&.downcase == "websocket"
  end

  def authenticate(env)
    token = bearer_token(env)
    return verify_jwt(token) if token

    api_key = env["HTTP_X_API_KEY"]
    return verify_api_key(api_key) if api_key

    nil
  end
end
