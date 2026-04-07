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
      },
      {
        version: 2,
        table:   :game_meta,
        up:      lambda do |db|
          db.alter_table(:game_meta) do
            add_column :developer,    String unless db[:game_meta].columns.include?(:developer)
            add_column :publisher,    String unless db[:game_meta].columns.include?(:publisher)
            add_column :release_date, String unless db[:game_meta].columns.include?(:release_date)
            add_column :genre,        String unless db[:game_meta].columns.include?(:genre)
            add_column :description,  String unless db[:game_meta].columns.include?(:description)
            add_column :dlsite_id,    String unless db[:game_meta].columns.include?(:dlsite_id)
            add_column :language,     String unless db[:game_meta].columns.include?(:language)
          end
        end
      }
    ]
  end

  def routes(r)
    r.on "resources/game" do
      r.on Integer do |resource_id|
        r.get("meta")         { get_meta(resource_id) }
        r.post("meta")        { update_meta(resource_id, r) }
        r.post("launch-ping") { record_launch(resource_id) }
        r.get                 { show(resource_id) }
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

  GAME_META_FIELDS = %w[executable_path platform launcher steam_app_id moonlight_enabled developer publisher release_date genre description dlsite_id language].freeze
  GAME_BOOL_FIELDS = %w[moonlight_enabled].freeze

  def get_meta(resource_id)
    DB.connection[:game_meta].where(resource_id: resource_id).first || {}
  end

  def update_meta(resource_id, r)
    attrs = GAME_META_FIELDS.each_with_object({}) do |k, h|
      next unless r.POST.key?(k)
      h[k.to_sym] = GAME_BOOL_FIELDS.include?(k) ? (r.POST[k] == "true") : r.POST[k]
    end
    DB.connection[:game_meta].insert_conflict(
      target: :resource_id,
      update: attrs.merge(updated_at: Sequel::CURRENT_TIMESTAMP)
    ).insert(attrs.merge(resource_id: resource_id, platform: attrs[:platform] || "windows"))
    { ok: true }
  end

  def record_launch(resource_id)
    DB.connection[:game_meta].where(resource_id: resource_id)
                             .update(last_played_at: Sequel::CURRENT_TIMESTAMP)
    { ok: true }
  end
end
