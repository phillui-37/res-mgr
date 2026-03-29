# frozen_string_literal: true

# P2PController handles REST endpoints for P2P room/session management.
#
# GET  /p2p/rooms              → list active rooms (admin view)
# POST /p2p/rooms              → create a named room
# GET  /p2p/rooms/:id          → room info + peer count
# POST /p2p/rooms/:id/share    → associate a resource with a room (access-control gated)
# DELETE /p2p/rooms/:id/share/:resource_id → revoke resource from room
class P2PController
  extend ControllerHelpers

  class << self
    def call(r)
      r.on "rooms" do
        # Deeper paths must come before terminal r.get/r.post to avoid
        # them consuming all matching-method requests via Roda's `always`.
        r.on String do |room_id|
          r.is do
            r.get { room_info(room_id) }
          end

          r.on "share" do
            r.is { r.post { share_resource(room_id, r) } }
            r.is(Integer) do |rid|
              r.delete { revoke_resource(room_id, rid) }
            end
          end
        end

        r.get  { list_rooms }
        r.post { create_room(r) }
      end
    end

    private

    def list_rooms
      Websocket::P2PSignaling.instance.rooms_summary
    end

    def create_room(r)
      room_id = r.POST["room_id"] || SecureRandom.uuid
      { room_id: room_id, ws_url: "/ws/p2p?room=#{room_id}" }
    end

    def room_info(room_id)
      peer_ids = Websocket::P2PSignaling.instance.room_peer_ids(room_id)
      halt!(404, "Room not found") unless peer_ids

      shared = DB.connection[:p2p_room_resources]
                 .where(room_id: room_id)
                 .select_map(:resource_id)
      { room_id: room_id, peer_count: peer_ids.size, shared_resources: shared }
    end

    def share_resource(room_id, r)
      resource_id = r.POST["resource_id"]&.to_i
      halt!(422, "resource_id is required") unless resource_id

      resource = Resource[resource_id]
      halt!(404, "Resource not found") unless resource

      DB.connection[:p2p_room_resources].insert_ignore.insert(
        room_id:     room_id,
        resource_id: resource_id,
        created_at:  Sequel::CURRENT_TIMESTAMP
      )

      Websocket::Hub.instance.publish("p2p/#{room_id}", {
        type: "resource_shared", resource: resource.to_api_h
      })

      { ok: true, room_id: room_id, resource_id: resource_id }
    end

    def revoke_resource(room_id, resource_id)
      deleted = DB.connection[:p2p_room_resources]
                  .where(room_id: room_id, resource_id: resource_id)
                  .delete

      halt!(404, "Shared resource not found") if deleted.zero?

      { ok: true, revoked: resource_id }
    end
  end
end
