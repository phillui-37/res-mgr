# frozen_string_literal: true

require "digest"

# ResourceController handles the shared resource inventory REST API.
#
# GET    /resources              → list (filterable by plugin, type, tags, name, meta_cond[])
# POST   /resources              → create
# GET    /resources/:id          → show
# PATCH  /resources/:id          → update
# DELETE /resources/:id          → soft-delete (sets active=false)
# GET    /resources/duplicates   → list groups of resources sharing the same checksum
# POST   /resources/:id/checksum → compute & persist SHA-256 for a local-path resource
# POST   /resources/:id/remove-request → initiate two-step remote removal
#
# meta_cond[] format: "plugin:field:value" — fuzzy LIKE match on plugin's meta table column.
# Multiple conditions are ANDed. Joining multiple plugin tables gives empty results
# (since a resource belongs to exactly one plugin), which is correct AND semantics.
class ResourceController
  extend ControllerHelpers

  META_FILTER_FIELDS = {
    "ebook"         => { table: :ebook_meta,         fields: %w[author illustrator publisher genre description isbn] },
    "music"         => { table: :music_meta,          fields: %w[artist album_artist album genre composer label isrc] },
    "video"         => { table: :video_meta,          fields: %w[director studio genre description resolution video_codec audio_codec] },
    "game"          => { table: :game_meta,           fields: %w[developer publisher genre description steam_app_id dlsite_id] },
    "pic"           => { table: :pic_meta,            fields: %w[creator circle event series_title] },
    "online_viewer" => { table: :online_viewer_meta,  fields: %w[title description original_url] },
  }.freeze

  class << self
    def call(r)
      r.get("duplicates") { duplicates }

      r.on Integer do |id|
        resource = find_resource!(id)

        r.get    { resource.to_api_h }
        r.patch  { update_resource(resource, r) }
        r.delete { delete_resource(resource) }
        r.post("checksum")       { compute_checksum(resource) }
        r.post("remove-request") { remove_request(resource) }
      end

      r.get  { list(r) }
      r.post { create_resource(r) }
      r.delete { bulk_delete(r) }
    end

    private

    ALLOWED_PER_PAGE = [10, 25, 50, 100, 200].freeze

    def list(r)
      requested = r.params["per_page"].to_i
      per_page  = if requested <= 0
                    50
                  else
                    ALLOWED_PER_PAGE.min_by { |n| (n - requested).abs }
                  end
      page = [r.params["page"].to_i, 1].max

      ds = Resource.where(active: true)
      ds = ds.where(plugin: r.params["plugin"]) if r.params["plugin"] && !r.params["plugin"].empty?
      ds = ds.where(type:   r.params["type"])   if r.params["type"] && !r.params["type"].empty?
      ds = ds.where(Sequel.like(:name, "%#{r.params['name'].gsub(/[%_\\]/) { |c| "\\#{c}" }}%")) if r.params["name"]

      ds = ds.where(language: r.params["language"]) if r.params["language"]

      # Meta conditions: "plugin:field:value" fuzzy-match via JOIN on plugin meta table
      meta_conds = Array(r.params["meta_cond"]).compact.reject(&:empty?)
      unless meta_conds.empty?
        conds_by_plugin = {}
        meta_conds.each do |cond|
          plugin_key, field, value = cond.split(":", 3)
          next unless plugin_key && field && value
          cfg = META_FILTER_FIELDS[plugin_key]
          next unless cfg && cfg[:fields].include?(field)
          (conds_by_plugin[plugin_key] ||= []) << { field: field.to_sym, value: value, table: cfg[:table] }
        end

        conds_by_plugin.each do |plugin_key, conditions|
          meta_table = conditions.first[:table]
          ds = ds.where(Sequel[:resources][:plugin] => plugin_key)
          ds = ds.select_all(:resources).join(meta_table, resource_id: Sequel[:resources][:id])
          conditions.each do |c|
            safe_val = "%#{c[:value].gsub(/[%_\\]/) { |ch| "\\#{ch}" }}%"
            ds = ds.where(Sequel.like(Sequel[meta_table][c[:field]], safe_val))
          end
        end
      end

      total  = ds.count
      result = ds.limit(per_page).offset((page - 1) * per_page).map(&:to_api_h)

      r.response["X-Total-Count"]        = total.to_s
      r.response["X-Page"]               = page.to_s
      r.response["X-Per-Page"]           = per_page.to_s
      r.response["X-Allowed-Per-Page"]   = ALLOWED_PER_PAGE.join(",")

      result
    end

    def create_resource(r)
      attrs    = permitted_attrs(r.POST)
      resource = Resource.new(attrs)
      halt_invalid!(resource) unless resource.valid?
      resource.save
      run_taggers!(resource)
      r.response.status = 201
      resource.to_api_h
    end

    def update_resource(resource, r)
      attrs = permitted_attrs(r.POST)
      resource.set(attrs)
      halt_invalid!(resource) unless resource.valid?
      resource.save
      run_taggers!(resource)
      resource.to_api_h
    end

    def delete_resource(resource)
      resource.update(active: false)
      { deleted: resource.id }
    end

    def bulk_delete(r)
      ids = Array(r.params["ids"]).map(&:to_i).select { |id| id > 0 }
      halt!(422, "ids[] is required and must be non-empty") if ids.empty?
      deleted = Resource.where(id: ids, active: true).update(active: false)
      { deleted: ids, count: deleted }
    end

    def duplicates
      Resource
        .where(active: true)
        .exclude(checksum: nil)
        .group_and_count(:checksum)
        .having { count > 1 }
        .map do |row|
          {
            checksum: row[:checksum],
            count:    row[:count],
            resources: Resource.where(checksum: row[:checksum], active: true).map(&:to_api_h)
          }
        end
    end

    def compute_checksum(resource)
      paths = resource.locations.map { |l| l["path"] }.select { |p| ::File.exist?(p) }
      halt!(422, "No accessible local paths for this resource") if paths.empty?

      digest = Digest::SHA256.file(paths.first).hexdigest
      resource.update(checksum: digest)
      { id: resource.id, checksum: digest }
    end

    def remove_request(resource)
      halt!(422, "Cannot remotely remove online-provider resources") \
        if resource.plugin == "online_viewer"

      event = { type: "remove_request", resource: resource.to_api_h }
      Websocket::Hub.instance.publish("resources", event)
      { status: "pending_confirmation", resource_id: resource.id }
    end

    def find_resource!(id)
      resource = Resource[id]
      halt!(404, "Resource #{id} not found") unless resource
      resource
    end

    def permitted_attrs(params)
      %w[name type plugin locations tags checksum language active].each_with_object({}) do |key, h|
        h[key.to_sym] = params[key] if params.key?(key)
      end
    end

    # Run every loaded service plugin that has the :tagging capability,
    # but only when the resource's own plugin is taggable (has :inventory).
    # New tagger plugins are picked up automatically without changes here.
    def run_taggers!(resource)
      return unless PluginRegistry.instance.find(resource.plugin)&.taggable?

      PluginRegistry.instance.all
        .select { |p| p.capabilities.include?(:tagging) && p.respond_to?(:run!) }
        .each   { |tagger| tagger.run!(resource) }
    end

    def halt_invalid!(resource)
      halt!(422, resource.errors.full_messages.join(", "))
    end
  end
end
