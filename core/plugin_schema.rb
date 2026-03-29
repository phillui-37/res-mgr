# frozen_string_literal: true

# Manages per-plugin database schema migrations.
#
# Each plugin declares schema_migrations as an array of Hashes:
#
#   def schema_migrations
#     [
#       { version: 1, table: :ebook_progress, up: lambda { |db| db.create_table?(...) } }
#     ]
#   end
#
# Legacy: plain Procs (without :version/:table) are also accepted for backwards
# compatibility.  In that case the version is the 1-based array index and no table
# is dropped on rollback.
#
# PluginSchema wraps each migration in a transaction and tracks applied versions in
# a plugin-scoped migration table (schema_migrations_<plugin_name>).
#
# This isolates plugin schemas so unloading a plugin can clean up its tables.
module PluginSchema
  class << self
    # Run all pending migrations for the given plugin.
    def apply!(plugin)
      return if plugin.schema_migrations.empty?

      db = DB.connection
      each_migration(plugin) do |version, migration_proc, _table|
        run_migration(db, plugin.name, version, migration_proc)
      end
    end

    # Roll back all migrations for the given plugin (called on unload).
    # Drops tables declared in migrations and removes tracking records.
    def rollback!(plugin)
      return if plugin.schema_migrations.empty?

      db         = DB.connection
      table_name = migration_table(plugin.name)

      each_migration(plugin) do |version, _proc, table|
        next unless db.table_exists?(table_name) &&
                    db[table_name].where(version: version).count.positive?

        db.drop_table?(table) if table
        db[table_name].where(version: version).delete
      end
    end

    private

    def each_migration(plugin)
      plugin.schema_migrations.each_with_index do |entry, idx|
        if entry.is_a?(Hash)
          yield entry.fetch(:version), entry.fetch(:up), entry[:table]
        else
          # Legacy plain Proc: version = 1-based index, no table to drop
          yield idx + 1, entry, nil
        end
      end
    end

    def migration_table(plugin_name)
      :"schema_migrations_#{plugin_name}"
    end

    def ensure_tracking_table!(db, plugin_name)
      table = migration_table(plugin_name)
      db.create_table?(table) do
        Integer  :version,    null: false, primary_key: true
        DateTime :applied_at, default: Sequel::CURRENT_TIMESTAMP
      end
      table
    end

    def run_migration(db, plugin_name, version, migration_proc)
      table = ensure_tracking_table!(db, plugin_name)
      return if db[table].where(version: version).count.positive?

      db.transaction do
        migration_proc.call(db)
        db[table].insert(version: version)
      end
    end
  end
end
