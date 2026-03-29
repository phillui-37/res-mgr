# frozen_string_literal: true

require "digest"

# ResourceController handles the shared resource inventory REST API.
#
# GET    /resources              → list (filterable by plugin, type, tags, name)
# POST   /resources              → create
# GET    /resources/:id          → show
# PATCH  /resources/:id          → update
# DELETE /resources/:id          → soft-delete (sets active=false)
# GET    /resources/duplicates   → list groups of resources sharing the same checksum
# POST   /resources/:id/checksum → compute & persist SHA-256 for a local-path resource
# POST   /resources/:id/remove-request → initiate two-step remote removal
class ResourceController
  extend ControllerHelpers

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
    end

    private

    def list(r)
      per_page = r.params["per_page"].to_i
      per_page = 50  if per_page <= 0
      per_page = 200 if per_page > 200
      page = [r.params["page"].to_i, 1].max

      ds = Resource.where(active: true)
      ds = ds.where(plugin: r.params["plugin"]) if r.params["plugin"]
      ds = ds.where(type:   r.params["type"])   if r.params["type"]
      ds = ds.where(Sequel.like(:name, "%#{r.params['name'].gsub(/[%_\\]/) { |c| "\\#{c}" }}%")) if r.params["name"]

      total  = ds.count
      result = ds.limit(per_page).offset((page - 1) * per_page).map(&:to_api_h)

      r.response["X-Total-Count"] = total.to_s
      r.response["X-Page"]        = page.to_s
      r.response["X-Per-Page"]    = per_page.to_s

      result
    end

    def create_resource(r)
      attrs    = permitted_attrs(r.POST)
      resource = Resource.new(attrs)
      halt_invalid!(resource) unless resource.valid?
      resource.save
      r.response.status = 201
      resource.to_api_h
    end

    def update_resource(resource, r)
      attrs = permitted_attrs(r.POST)
      resource.set(attrs)
      halt_invalid!(resource) unless resource.valid?
      resource.save
      resource.to_api_h
    end

    def delete_resource(resource)
      resource.update(active: false)
      { deleted: resource.id }
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
      paths = resource.locations.select { |l| ::File.exist?(l) }
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
      %w[name type plugin locations tags checksum active].each_with_object({}) do |key, h|
        h[key.to_sym] = params[key] if params.key?(key)
      end
    end

    def halt_invalid!(resource)
      halt!(422, resource.errors.full_messages.join(", "))
    end
  end
end
