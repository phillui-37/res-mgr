# frozen_string_literal: true

# Shared helpers for specs that touch the database.
module DbHelpers
  # Reset PluginRegistry to a clean state for unit tests.
  # Call in a before block; restores original state in after.
  def with_clean_registry
    original = PluginRegistry.instance.instance_variable_get(:@plugins).dup
    PluginRegistry.instance.instance_variable_set(:@plugins, {})
    yield
  ensure
    PluginRegistry.instance.instance_variable_set(:@plugins, original)
  end

  # Create a Resource with sensible defaults for test purposes.
  def build_resource(attrs = {})
    Resource.new({
      name:   "test-resource",
      type:   "ebook",
      plugin: "ebook"
    }.merge(attrs))
  end

  def create_resource(attrs = {})
    r = build_resource(attrs)
    r.save
    r
  end
end
