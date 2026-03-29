# frozen_string_literal: true

require_relative "../../core/base_plugin"

# Ebook plugin: manages pdf, epub, azw3, txt, mobi files with reading progress.
class EbookPlugin < BasePlugin
  EXTENSIONS = %w[pdf epub azw3 txt mobi].freeze

  def name        = "ebook"
  def version     = "1.0.0"
  def capabilities = %i[inventory viewer progress]

  def schema_migrations
    [
      {
        version: 1,
        table:   :ebook_progress,
        up:      lambda do |db|
          db.create_table?(:ebook_progress) do
            primary_key :id
            foreign_key :resource_id, :resources, null: false, on_delete: :cascade
            String  :device,        null: false
            Integer :current_page,  default: 0
            Integer :total_pages
            Float   :percentage,    default: 0.0
            String  :cfi_position              # EPUB CFI string for precise position
            DateTime :updated_at,   default: Sequel::CURRENT_TIMESTAMP

            unique %i[resource_id device]
            index :resource_id
          end
        end
      }
    ]
  end

  def routes(r)
    r.on "resources/ebook" do
      r.on Integer do |resource_id|
        r.get("progress")  { get_progress(resource_id) }
        r.post("progress") { update_progress(resource_id, r) }
      end

      r.get { Resource.where(plugin: "ebook", active: true).map(&:to_api_h) }
    end
  end

  private

  def get_progress(resource_id)
    DB.connection[:ebook_progress]
      .where(resource_id: resource_id)
      .all
  end

  def update_progress(resource_id, r)
    params = r.POST
    device = params["device"] || "unknown"

    DB.connection[:ebook_progress].insert_conflict(
      target: %i[resource_id device],
      update: {
        current_page: params["current_page"]&.to_i,
        total_pages:  params["total_pages"]&.to_i,
        percentage:   params["percentage"]&.to_f,
        cfi_position: params["cfi_position"],
        updated_at:   Sequel::CURRENT_TIMESTAMP
      }
    ).insert(
      resource_id:  resource_id,
      device:       device,
      current_page: params["current_page"]&.to_i || 0,
      total_pages:  params["total_pages"]&.to_i,
      percentage:   params["percentage"]&.to_f || 0.0,
      cfi_position: params["cfi_position"]
    )

    Websocket::Hub.instance.publish("progress/ebook/#{resource_id}", {
      resource_id: resource_id, device: device, percentage: params["percentage"]&.to_f
    })

    { ok: true }
  end
end
