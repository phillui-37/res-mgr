# frozen_string_literal: true

# Shared helpers for all static controller classes.
# Include or extend this module to gain a consistent halt! helper.
module ControllerHelpers
  def halt!(status, message)
    throw :halt, [status, { "content-type" => "application/json" },
                  [Oj.dump({ error: message }, mode: :compat)]]
  end
end
