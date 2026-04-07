# frozen_string_literal: true

# Device represents a registered client device that can track resource progress.
class Device < Sequel::Model
  def to_api_h
    {
      id:         id,
      name:       name,
      created_at: created_at&.iso8601
    }
  end
end
