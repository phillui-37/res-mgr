# frozen_string_literal: true

require "spec_helper"

RSpec.describe PluginSchema, type: :db do
  # Minimal plugin stub with one migration that creates a tracking table.
  def make_plugin(plugin_name, migrations = nil)
    migrations ||= [
      lambda do |db|
        db.create_table?(:"#{plugin_name}_items") do
          primary_key :id
          String :title
        end
      end
    ]

    instance_double(BasePlugin,
                    name: plugin_name,
                    schema_migrations: migrations)
  end

  describe ".apply!" do
    it "creates the plugin tracking table" do
      plugin = make_plugin("schema_test_a")
      described_class.apply!(plugin)
      expect(DB.connection.table_exists?(:schema_migrations_schema_test_a)).to be true
    end

    it "runs the migration proc, creating the target table" do
      plugin = make_plugin("schema_test_b")
      described_class.apply!(plugin)
      expect(DB.connection.table_exists?(:schema_test_b_items)).to be true
    end

    it "records the migration version in the tracking table" do
      plugin = make_plugin("schema_test_c")
      described_class.apply!(plugin)
      count = DB.connection[:schema_migrations_schema_test_c].where(version: 1).count
      expect(count).to eq(1)
    end

    it "is idempotent — does not re-run already applied migrations" do
      call_count = 0
      migrations = [lambda { |_db| call_count += 1 }]
      plugin = make_plugin("schema_test_d", migrations)
      described_class.apply!(plugin)
      described_class.apply!(plugin)
      expect(call_count).to eq(1)
    end

    it "is a no-op when schema_migrations is empty" do
      plugin = instance_double(BasePlugin, name: "no_migs", schema_migrations: [])
      expect { described_class.apply!(plugin) }.not_to raise_error
    end

    it "handles multiple migration steps in order" do
      step_order = []
      migrations = [
        lambda { |_db| step_order << 1 },
        lambda { |_db| step_order << 2 }
      ]
      plugin = make_plugin("schema_test_e", migrations)
      described_class.apply!(plugin)
      expect(step_order).to eq([1, 2])
    end
  end

  describe ".rollback!" do
    it "removes version records from the tracking table" do
      plugin = make_plugin("schema_test_f")
      described_class.apply!(plugin)
      described_class.rollback!(plugin)
      count = DB.connection[:schema_migrations_schema_test_f].count
      expect(count).to eq(0)
    end

    it "is a no-op when schema_migrations is empty" do
      plugin = instance_double(BasePlugin, name: "no_migs2", schema_migrations: [])
      expect { described_class.rollback!(plugin) }.not_to raise_error
    end
  end
end
