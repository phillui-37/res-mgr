# frozen_string_literal: true

require_relative "../authenticator"

module Websocket
  # Authenticates WebSocket upgrade requests.
  # Accepts token via:
  #   1. ?token=<jwt>  query parameter  (convenient for browser clients)
  #   2. Authorization: Bearer <jwt>  header  (preferred for machine clients)
  #   3. X-API-Key header
  #
  # Sets env["res_mgr.principal"] like AuthMiddleware does for HTTP requests.
  # Returns 401 if no valid credential is provided.
  class Auth
    include Authenticator

    def initialize(app)
      @app = app
    end

    def call(env)
      return @app.call(env) unless Faye::WebSocket.websocket?(env)

      principal = authenticate(env)
      return unauthorized unless principal

      env["res_mgr.principal"] = principal
      @app.call(env)
    end

    private

    def authenticate(env)
      token = token_from_query(env) || bearer_token(env)
      return verify_jwt(token) if token

      api_key = env["HTTP_X_API_KEY"]
      verify_api_key(api_key) if api_key
    end

    def token_from_query(env)
      query = env["QUERY_STRING"] || ""
      match = query.match(/(?:^|&)token=([^&]+)/)
      match&.[](1)
    end
  end
end
