# frozen_string_literal: true

require_relative "../../core/base_plugin"

# Game plugin: manages Windows game binaries with metadata (launch path, platform info).
class GamePlugin < BasePlugin
  include ControllerHelpers
  def name        = "game"
  def version     = "1.0.0"
  def capabilities = %i[inventory]

  def schema_migrations
    [
      {
        version: 1,
        table:   :game_meta,
        up:      lambda do |db|
          db.create_table?(:game_meta) do
            primary_key :id
            foreign_key :resource_id, :resources, null: false, on_delete: :cascade
            String  :executable_path
            String  :platform,        default: "windows"
            String  :launcher                            # e.g. "steam", "direct", "lutris"
            String  :steam_app_id
            TrueClass :moonlight_enabled, default: false # desktop streaming via Moonlight
            DateTime :last_played_at
            DateTime :updated_at,     default: Sequel::CURRENT_TIMESTAMP

            unique :resource_id
          end
        end
      }
    ]
  end

  def routes(r)
    r.on "resources/game" do
      r.on Integer do |resource_id|
        r.get                 { show(resource_id) }
        r.post("meta")        { update_meta(resource_id, r) }
        r.post("launch-ping") { record_launch(resource_id) }
      end

      r.get { Resource.where(plugin: "game", active: true).map(&:to_api_h) }
    end
  end

  private

  def show(resource_id)
    resource = Resource[resource_id]
    halt!(404, "Resource #{resource_id} not found") unless resource

    meta = DB.connection[:game_meta].where(resource_id: resource_id).first
    resource.to_api_h.merge(meta: meta || {})
  end

  def update_meta(resource_id, r)
    params = r.POST
    DB.connection[:game_meta].insert_conflict(
      target: :resource_id,
      update: {
        executable_path:   params["executable_path"],
        launcher:          params["launcher"],
        steam_app_id:      params["steam_app_id"],
        moonlight_enabled: params["moonlight_enabled"] == "true",
        updated_at:        Sequel::CURRENT_TIMESTAMP
      }
    ).insert(
      resource_id:      resource_id,
      executable_path:  params["executable_path"],
      platform:         params["platform"] || "windows",
      launcher:         params["launcher"],
      steam_app_id:     params["steam_app_id"],
      moonlight_enabled: params["moonlight_enabled"] == "true"
    )
    { ok: true }
  end

  def record_launch(resource_id)
    DB.connection[:game_meta].where(resource_id: resource_id)
                             .update(last_played_at: Sequel::CURRENT_TIMESTAMP)
    { ok: true }
  end
end
