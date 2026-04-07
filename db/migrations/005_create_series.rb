# frozen_string_literal: true

Sequel.migration do
  up do
    create_table(:series) do
      primary_key :id
      String   :name,   null: false
      String   :plugin, null: false
      DateTime :created_at, default: Sequel::CURRENT_TIMESTAMP

      index [:plugin]
      index [:name, :plugin], unique: true
    end
  end

  down do
    drop_table(:series)
  end
end
