# frozen_string_literal: true

require_relative "core/boot"

use RequestLogger
use AuthMiddleware

run Core::App.app
