# frozen_string_literal: true

require_relative "../../core/base_plugin"

# Music plugin: manages flac, mp3, wav+cue files with playback position tracking.
class MusicPlugin < BasePlugin
  EXTENSIONS = %w[flac mp3 wav cue].freeze

  def name        = "music"
  def version     = "1.0.0"
  def capabilities = %i[inventory viewer progress]

  def schema_migrations
    [
      {
        version: 1,
        table:   :music_progress,
        up:      lambda do |db|
          db.create_table?(:music_progress) do
            primary_key :id
            foreign_key :resource_id, :resources, null: false, on_delete: :cascade
            String  :device,         null: false
            Integer :position_ms,    default: 0   # playback position in milliseconds
            Integer :duration_ms
            DateTime :updated_at,    default: Sequel::CURRENT_TIMESTAMP

            unique %i[resource_id device]
            index :resource_id
          end
        end
      }
    ]
  end

  def routes(r)
    r.on "resources/music" do
      r.on Integer do |resource_id|
        r.get("progress")  { get_progress(resource_id) }
        r.post("progress") { update_progress(resource_id, r) }
      end

      r.get { Resource.where(plugin: "music", active: true).map(&:to_api_h) }
    end
  end

  private

  def get_progress(resource_id)
    DB.connection[:music_progress].where(resource_id: resource_id).all
  end

  def update_progress(resource_id, r)
    params  = r.POST
    device  = params["device"] || "unknown"

    DB.connection[:music_progress].insert_conflict(
      target: %i[resource_id device],
      update: { position_ms: params["position_ms"]&.to_i, duration_ms: params["duration_ms"]&.to_i,
                updated_at: Sequel::CURRENT_TIMESTAMP }
    ).insert(
      resource_id:  resource_id,
      device:       device,
      position_ms:  params["position_ms"]&.to_i || 0,
      duration_ms:  params["duration_ms"]&.to_i
    )

    Websocket::Hub.instance.publish("progress/music/#{resource_id}", {
      resource_id: resource_id, device: device, position_ms: params["position_ms"]&.to_i
    })

    { ok: true }
  end
end
