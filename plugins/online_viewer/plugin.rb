# frozen_string_literal: true

require_relative "../../core/base_plugin"

# OnlineViewer plugin: tracks progress for resources accessed via external web viewers
# (BookWalker, Kindle Cloud, DLSite viewer, etc.).
# Progress is synced in real-time via WebSocket.
class OnlineViewerPlugin < BasePlugin
  def name        = "online_viewer"
  def version     = "1.0.0"
  def capabilities = %i[inventory viewer progress]

  def schema_migrations
    [
      {
        version: 1,
        table:   :online_viewer_sessions,
        up:      lambda do |db|
          db.create_table?(:online_viewer_sessions) do
            primary_key :id
            foreign_key :resource_id, :resources, null: false, on_delete: :cascade
            String  :provider,    null: false   # e.g. "bookwalker", "kindle", "dlsite"
            String  :url,         null: false
            String  :auth_token                 # encrypted or hashed; never logged
            String  :device,      null: false
            Integer :progress_pct, default: 0  # 0-100
            String  :last_page
            DateTime :accessed_at, default: Sequel::CURRENT_TIMESTAMP
            DateTime :updated_at,  default: Sequel::CURRENT_TIMESTAMP

            unique %i[resource_id device provider]
            index :resource_id
          end
        end
      }
    ]
  end

  def routes(r)
    r.on "resources/online_viewer" do
      r.on Integer do |resource_id|
        r.get("sessions")  { list_sessions(resource_id) }
        r.post("progress") { update_progress(resource_id, r) }
      end

      r.get { Resource.where(plugin: "online_viewer", active: true).map(&:to_api_h) }
    end
  end

  private

  def list_sessions(resource_id)
    DB.connection[:online_viewer_sessions]
      .where(resource_id: resource_id)
      .all
      .map { |row| row.except(:auth_token) }
  end

  def update_progress(resource_id, r)
    params   = r.POST
    device   = params["device"] || "unknown"
    provider = params["provider"] || "unknown"

    DB.connection[:online_viewer_sessions].insert_conflict(
      target: %i[resource_id device provider],
      update: {
        progress_pct: params["progress_pct"]&.to_i,
        last_page:    params["last_page"],
        updated_at:   Sequel::CURRENT_TIMESTAMP,
        accessed_at:  Sequel::CURRENT_TIMESTAMP
      }
    ).insert(
      resource_id:  resource_id,
      provider:     provider,
      url:          params["url"] || "",
      auth_token:   params["auth_token"],
      device:       device,
      progress_pct: params["progress_pct"]&.to_i || 0,
      last_page:    params["last_page"]
    )

    Websocket::Hub.instance.publish("progress/online_viewer/#{resource_id}", {
      resource_id: resource_id, provider: provider,
      device: device, progress_pct: params["progress_pct"]&.to_i
    })

    { ok: true }
  end
end
