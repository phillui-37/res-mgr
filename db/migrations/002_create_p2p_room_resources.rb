# frozen_string_literal: true

# Core migration: p2p_room_resources join table.
Sequel.migration do
  up do
    create_table(:p2p_room_resources) do
      String   :room_id,     null: false
      Integer  :resource_id, null: false
      DateTime :created_at,  default: Sequel::CURRENT_TIMESTAMP

      primary_key %i[room_id resource_id]
      foreign_key [:resource_id], :resources, on_delete: :cascade
    end
  end

  down do
    drop_table(:p2p_room_resources)
  end
end
