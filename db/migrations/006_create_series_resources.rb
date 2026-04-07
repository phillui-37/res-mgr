# frozen_string_literal: true

Sequel.migration do
  up do
    create_table(:series_resources) do
      foreign_key :series_id,   :series,    null: false, on_delete: :cascade
      foreign_key :resource_id, :resources, null: false, on_delete: :cascade

      primary_key [:series_id, :resource_id]
      index :resource_id
    end
  end

  down do
    drop_table(:series_resources)
  end
end
