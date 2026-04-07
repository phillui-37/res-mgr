# frozen_string_literal: true

Sequel.migration do
  up do
    alter_table(:resources) do
      add_column :language, String, null: true
    end
    add_index :resources, :language
  end

  down do
    alter_table(:resources) do
      drop_column :language
    end
  end
end
