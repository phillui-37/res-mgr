# frozen_string_literal: true

Sequel.migration do
  up do
    create_table(:devices) do
      primary_key :id
      String   :name, null: false, unique: true
      DateTime :created_at, default: Sequel::CURRENT_TIMESTAMP

      index [:name], unique: true
    end
  end

  down do
    drop_table(:devices)
  end
end
