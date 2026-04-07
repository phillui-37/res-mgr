# frozen_string_literal: true

# DeviceController manages client device identity registration.
#
# GET    /devices         → list all registered devices
# POST   /devices         → register or reclaim a device by name (upsert)
# DELETE /devices/:name   → unregister a device
class DeviceController
  extend ControllerHelpers

  class << self
    def call(r)
      r.get  { list }
      r.post { upsert(r) }

      r.on String do |name|
        r.delete { remove(name) }
      end
    end

    private

    def list
      Device.order(:name).map(&:to_api_h)
    end

    def upsert(r)
      name = r.POST["name"]&.strip
      halt!(422, "name is required") if name.nil? || name.empty?

      existing = Device.first(name: name)
      if existing
        r.response.status = 200
        existing.to_api_h
      else
        device = Device.create(name: name)
        r.response.status = 201
        device.to_api_h
      end
    end

    def remove(name)
      device = Device.first(name: name)
      halt!(404, "Device '#{name}' not found") unless device
      device.destroy
      { deleted: name }
    end
  end
end
