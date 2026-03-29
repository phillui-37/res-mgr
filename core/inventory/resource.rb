# frozen_string_literal: true

require "json"

# Resource is the Sequel model for the shared resources table.
# All plugins share this table; plugin-specific data lives in extension tables.
class Resource < Sequel::Model
  plugin :timestamps, update_on_create: true

  # JSON-encoded columns deserialized on access.
  def locations
    val = super
    val ? JSON.parse(val) : []
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
      active:     active,
      created_at: created_at&.iso8601,
      updated_at: updated_at&.iso8601
    }
  end
end
