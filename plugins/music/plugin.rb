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
      },
      {
        version: 2,
        table:   :music_meta,
        up:      lambda do |db|
          db.create_table?(:music_meta) do
            primary_key :id
            foreign_key :resource_id, :resources, null: false, on_delete: :cascade
            String  :artist
            String  :album_artist
            String  :album
            Integer :track_number
            Integer :disc_number
            Integer :year
            String  :genre
            Integer :duration_ms
            Integer :bitrate
            Integer :sample_rate
            String  :composer
            String  :label
            String  :isrc
            DateTime :updated_at, default: Sequel::CURRENT_TIMESTAMP

            unique :resource_id
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
        r.get("meta")      { get_meta(resource_id) }
        r.post("meta")     { update_meta(resource_id, r) }
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

  MUSIC_META_FIELDS = %w[artist album_artist album track_number disc_number year genre duration_ms bitrate sample_rate composer label isrc].freeze

  def get_meta(resource_id)
    DB.connection[:music_meta].where(resource_id: resource_id).first || {}
  end

  def update_meta(resource_id, r)
    int_fields = %w[track_number disc_number year duration_ms bitrate sample_rate]
    attrs = MUSIC_META_FIELDS.each_with_object({}) do |k, h|
      next unless r.POST.key?(k)
      h[k.to_sym] = int_fields.include?(k) ? r.POST[k]&.to_i : r.POST[k]
    end
    DB.connection[:music_meta].insert_conflict(
      target: :resource_id,
      update: attrs.merge(updated_at: Sequel::CURRENT_TIMESTAMP)
    ).insert(attrs.merge(resource_id: resource_id))
    { ok: true }
  end
end
