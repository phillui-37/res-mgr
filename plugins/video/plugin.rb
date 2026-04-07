# frozen_string_literal: true

require_relative "../../core/base_plugin"

# Video plugin: manages mp4 files with per-device playback position tracking.
class VideoPlugin < BasePlugin
  EXTENSIONS = %w[mp4 mkv avi mov].freeze

  def name        = "video"
  def version     = "1.0.0"
  def capabilities = %i[inventory viewer progress]

  def schema_migrations
    [
      {
        version: 1,
        table:   :video_progress,
        up:      lambda do |db|
          db.create_table?(:video_progress) do
            primary_key :id
            foreign_key :resource_id, :resources, null: false, on_delete: :cascade
            String  :device,       null: false
            Integer :position_ms,  default: 0
            Integer :duration_ms
            TrueClass :completed,  default: false
            DateTime :updated_at,  default: Sequel::CURRENT_TIMESTAMP

            unique %i[resource_id device]
            index :resource_id
          end
        end
      },
      {
        version: 2,
        table:   :video_meta,
        up:      lambda do |db|
          db.create_table?(:video_meta) do
            primary_key :id
            foreign_key :resource_id, :resources, null: false, on_delete: :cascade
            String  :director
            String  :studio
            Integer :year
            Integer :duration_ms
            String  :resolution
            String  :framerate
            String  :video_codec
            String  :audio_codec
            String  :subtitle_languages    # JSON array
            String  :audio_languages       # JSON array
            String  :genre
            String  :description
            DateTime :updated_at, default: Sequel::CURRENT_TIMESTAMP

            unique :resource_id
          end
        end
      }
    ]
  end

  def routes(r)
    r.on "resources/video" do
      r.on Integer do |resource_id|
        r.get("progress")  { get_progress(resource_id) }
        r.post("progress") { update_progress(resource_id, r) }
        r.get("meta")      { get_meta(resource_id) }
        r.post("meta")     { update_meta(resource_id, r) }
      end

      r.get { Resource.where(plugin: "video", active: true).map(&:to_api_h) }
    end
  end

  private

  def get_progress(resource_id)
    DB.connection[:video_progress].where(resource_id: resource_id).all
  end

  def update_progress(resource_id, r)
    params     = r.POST
    device     = params["device"] || "unknown"
    completed  = params["completed"] == "true" || params["position_ms"]&.to_i == params["duration_ms"]&.to_i

    DB.connection[:video_progress].insert_conflict(
      target: %i[resource_id device],
      update: { position_ms: params["position_ms"]&.to_i, duration_ms: params["duration_ms"]&.to_i,
                completed: completed, updated_at: Sequel::CURRENT_TIMESTAMP }
    ).insert(
      resource_id:  resource_id,
      device:       device,
      position_ms:  params["position_ms"]&.to_i || 0,
      duration_ms:  params["duration_ms"]&.to_i,
      completed:    completed
    )

    Websocket::Hub.instance.publish("progress/video/#{resource_id}", {
      resource_id: resource_id, device: device,
      position_ms: params["position_ms"]&.to_i, completed: completed
    })

    { ok: true }
  end

  VIDEO_META_FIELDS = %w[director studio year duration_ms resolution framerate video_codec audio_codec subtitle_languages audio_languages genre description].freeze
  VIDEO_INT_FIELDS  = %w[year duration_ms].freeze

  def get_meta(resource_id)
    DB.connection[:video_meta].where(resource_id: resource_id).first || {}
  end

  def update_meta(resource_id, r)
    attrs = VIDEO_META_FIELDS.each_with_object({}) do |k, h|
      next unless r.POST.key?(k)
      h[k.to_sym] = VIDEO_INT_FIELDS.include?(k) ? r.POST[k]&.to_i : r.POST[k]
    end
    DB.connection[:video_meta].insert_conflict(
      target: :resource_id,
      update: attrs.merge(updated_at: Sequel::CURRENT_TIMESTAMP)
    ).insert(attrs.merge(resource_id: resource_id))
    { ok: true }
  end
end
