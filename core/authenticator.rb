# frozen_string_literal: true

require "jwt"

# Shared authentication logic included by both AuthMiddleware and Websocket::Auth.
# Provides bearer-token extraction, JWT verification, and API-key verification.
module Authenticator
  private

  def bearer_token(env)
    header = env["HTTP_AUTHORIZATION"]
    return unless header&.start_with?("Bearer ")

    header.sub("Bearer ", "")
  end

  def verify_jwt(token)
    secret  = AppConfig.get(:auth, :jwt_secret)
    payload, = JWT.decode(token, secret, true, algorithm: "HS256")
    payload
  rescue JWT::DecodeError
    nil
  end

  def verify_api_key(key)
    allowed = Array(AppConfig.get(:auth, :api_keys))
    return nil unless allowed.include?(key)

    { "sub" => "api_key", "key" => key }
  end

  def unauthorized
    body = Oj.dump({ error: "Unauthorized" }, mode: :compat)
    [401, { "content-type" => "application/json", "content-length" => body.bytesize.to_s }, [body]]
  end
end
