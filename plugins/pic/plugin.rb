# frozen_string_literal: true

require_relative "../../core/base_plugin"

# Pic plugin: manages zip archives and loose image files (jpg, png, webp, etc.)
class PicPlugin < BasePlugin
  EXTENSIONS = %w[zip jpg jpeg png webp gif avif].freeze

  def name        = "pic"
  def version     = "1.0.0"
  def capabilities = %i[inventory viewer]

  def schema_migrations
    [
      {
        version: 1,
        table:   :pic_meta,
        up:      lambda do |db|
          db.create_table?(:pic_meta) do
            primary_key :id
            foreign_key :resource_id, :resources, null: false, on_delete: :cascade
            Integer :image_count
            String  :cover_path
            DateTime :updated_at, default: Sequel::CURRENT_TIMESTAMP

            unique :resource_id
          end
        end
      }
    ]
  end

  def routes(r)
    r.on "resources/pic" do
      r.on Integer do |resource_id|
        r.get              { Resource[resource_id]&.to_api_h }
        r.post("meta")     { update_meta(resource_id, r) }
      end

      r.get { Resource.where(plugin: "pic", active: true).map(&:to_api_h) }
    end
  end

  private

  def update_meta(resource_id, r)
    params = r.POST
    DB.connection[:pic_meta].insert_conflict(
      target: :resource_id,
      update: { image_count: params["image_count"]&.to_i, cover_path: params["cover_path"],
                updated_at: Sequel::CURRENT_TIMESTAMP }
    ).insert(
      resource_id:  resource_id,
      image_count:  params["image_count"]&.to_i,
      cover_path:   params["cover_path"]
    )
    { ok: true }
  end
end
