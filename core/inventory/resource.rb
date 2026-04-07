# frozen_string_literal: true

require "json"

# Resource is the Sequel model for the shared resources table.
# All plugins share this table; plugin-specific data lives in extension tables.
class Resource < Sequel::Model
  plugin :timestamps, update_on_create: true

  # JSON-encoded columns deserialized on access.
  # Supports both legacy plain-string locations and structured {device, path} objects.
  def locations
    val = super
    return [] unless val

    JSON.parse(val).map do |entry|
      case entry
      when Hash then entry
      when String then { "device" => "unknown", "path" => entry }
      end
    end.compact
  end

  def locations=(arr)
    super(JSON.generate(Array(arr)))
  end

  def tags
    val = super
    val ? JSON.parse(val) : []
  end

  def tags=(arr)
    super(JSON.generate(Array(arr)))
  end

  def validate
    super
    errors.add(:name,   "is required") if name.nil? || name.strip.empty?
    errors.add(:type,   "is required") if type.nil? || type.strip.empty?
    errors.add(:plugin, "is required") if plugin.nil? || plugin.strip.empty?
  end

  def to_api_h
    {
      id:         id,
      name:       name,
      type:       type,
      plugin:     plugin,
      locations:  locations,
      tags:       tags,
      checksum:   checksum,
      language:   language,
      active:     active,
      created_at: created_at&.iso8601,
      updated_at: updated_at&.iso8601
    }
  end
end
