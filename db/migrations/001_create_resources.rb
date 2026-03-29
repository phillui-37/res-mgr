# frozen_string_literal: true

# Core migration: creates the shared resources table used by all plugins.
Sequel.migration do
  up do
    create_table(:resources) do
      primary_key :id
      String  :name,      null: false
      String  :type,      null: false
      String  :checksum             # SHA-256 hex, nullable until computed
      column  :locations, :text    # JSON array of location strings
      column  :tags,      :text    # JSON array of tag strings
      String  :plugin,    null: false
      TrueClass :active,  default: true
      DateTime :created_at, default: Sequel::CURRENT_TIMESTAMP
      DateTime :updated_at, default: Sequel::CURRENT_TIMESTAMP

      index [:plugin]
      index [:checksum]
      index [:type]
    end
  end

  down do
    drop_table(:resources)
  end
end
