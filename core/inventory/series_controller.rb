# frozen_string_literal: true

# SeriesController manages grouping of resources into named series per plugin.
#
# GET    /series                              → list all series
# POST   /series                              → create a series
# GET    /series/:id                          → show series with members
# POST   /series/:id/resources               → add resource to series
# DELETE /series/:id/resources/:resource_id  → remove resource from series
class SeriesController
  extend ControllerHelpers

  class << self
    def call(r)
      r.on Integer do |id|
        series = find_series!(id)

        r.on "resources" do
          r.post { add_resource(series, r) }

          r.on Integer do |resource_id|
            r.delete { remove_resource(series, resource_id) }
          end
        end

        r.get    { show(series) }
        r.delete { delete_series(series) }
      end

      r.get  { list(r) }
      r.post { create_series(r) }
    end

    private

    def list(r)
      ds = DB.connection[:series]
      ds = ds.where(plugin: r.params["plugin"]) if r.params["plugin"]
      ds.order(:name).all.map { |s| series_to_h(s) }
    end

    def create_series(r)
      name   = r.POST["name"]&.strip
      plugin = r.POST["plugin"]&.strip
      halt!(422, "name is required")   if name.nil?   || name.empty?
      halt!(422, "plugin is required") if plugin.nil? || plugin.empty?

      id = DB.connection[:series].insert(name: name, plugin: plugin)
      r.response.status = 201
      series_to_h(DB.connection[:series].where(id: id).first)
    end

    def show(series)
      members = DB.connection[:series_resources]
        .join(:resources, id: :resource_id)
        .where(Sequel[:series_resources][:series_id] => series[:id])
        .select(Sequel[:resources].*)
        .map { |row| Resource.load(row).to_api_h }

      series_to_h(series).merge(resources: members)
    end

    def add_resource(series, r)
      resource_id = r.POST["resource_id"]&.to_i
      halt!(422, "resource_id is required") unless resource_id && resource_id > 0

      DB.connection[:series_resources].insert_conflict(
        target: [:series_id, :resource_id]
      ).insert(series_id: series[:id], resource_id: resource_id)

      r.response.status = 201
      { series_id: series[:id], resource_id: resource_id }
    end

    def remove_resource(series, resource_id)
      deleted = DB.connection[:series_resources]
        .where(series_id: series[:id], resource_id: resource_id)
        .delete
      halt!(404, "Resource #{resource_id} not in series") if deleted.zero?
      { series_id: series[:id], resource_id: resource_id, removed: true }
    end

    def delete_series(series)
      DB.connection[:series_resources].where(series_id: series[:id]).delete
      DB.connection[:series].where(id: series[:id]).delete
      { id: series[:id], deleted: true }
    end

    def find_series!(id)
      series = DB.connection[:series].where(id: id).first
      halt!(404, "Series #{id} not found") unless series
      series
    end

    def series_to_h(s)
      { id: s[:id], name: s[:name], plugin: s[:plugin], created_at: s[:created_at]&.iso8601 }
    end
  end
end
