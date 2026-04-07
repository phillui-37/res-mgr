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
      },
      {
        version: 2,
        table:   :pic_meta,
        up:      lambda do |db|
          db.alter_table(:pic_meta) do
            add_column :creator,      String unless db[:pic_meta].columns.include?(:creator)
            add_column :circle,       String unless db[:pic_meta].columns.include?(:circle)
            add_column :language,     String unless db[:pic_meta].columns.include?(:language)
            add_column :event,        String unless db[:pic_meta].columns.include?(:event)
            add_column :series_title, String unless db[:pic_meta].columns.include?(:series_title)
          end
        end
      }
    ]
  end

  def routes(r)
    r.on "resources/pic" do
      r.on Integer do |resource_id|
        r.get("meta")      { get_meta(resource_id) }
        r.post("meta")     { update_meta(resource_id, r) }
        r.get              { Resource[resource_id]&.to_api_h }
      end

      r.get { Resource.where(plugin: "pic", active: true).map(&:to_api_h) }
    end
  end

  private

  PIC_META_FIELDS = %w[image_count cover_path creator circle language event series_title].freeze
  PIC_INT_FIELDS  = %w[image_count].freeze

  def get_meta(resource_id)
    DB.connection[:pic_meta].where(resource_id: resource_id).first || {}
  end

  def update_meta(resource_id, r)
    attrs = PIC_META_FIELDS.each_with_object({}) do |k, h|
      next unless r.POST.key?(k)
      h[k.to_sym] = PIC_INT_FIELDS.include?(k) ? r.POST[k]&.to_i : r.POST[k]
    end
    DB.connection[:pic_meta].insert_conflict(
      target: :resource_id,
      update: attrs.merge(updated_at: Sequel::CURRENT_TIMESTAMP)
    ).insert(attrs.merge(resource_id: resource_id))
    { ok: true }
  end
end
