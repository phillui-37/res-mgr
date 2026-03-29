# frozen_string_literal: true

# Shared helpers for rack-test request specs.
module RequestHelpers
  def app
    @app ||= Rack::Builder.new do
      use AuthMiddleware
      run Core::App.app
    end
  end

  def auth_header(sub: "test")
    token = JWT.encode(
      { sub: sub, exp: Time.now.to_i + 3600 },
      AppConfig.get(:auth, :jwt_secret),
      "HS256"
    )
    { "HTTP_AUTHORIZATION" => "Bearer #{token}" }
  end

  def json_body
    Oj.load(last_response.body, mode: :compat)
  end

  def get_authed(path, params = {})
    get path, params, auth_header
  end

  def post_json(path, data, extra = {})
    post path,
         Oj.dump(data, mode: :compat),
         auth_header.merge("CONTENT_TYPE" => "application/json").merge(extra)
  end

  def patch_json(path, data, extra = {})
    patch path,
          Oj.dump(data, mode: :compat),
          auth_header.merge("CONTENT_TYPE" => "application/json").merge(extra)
  end
end
