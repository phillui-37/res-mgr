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
      },
      {
        version: 2,
        table:   :ebook_meta,
        up:      lambda do |db|
          db.create_table?(:ebook_meta) do
            primary_key :id
            foreign_key :resource_id, :resources, null: false, on_delete: :cascade
            String  :author
            String  :illustrator
            String  :publisher
            String  :published_date
            String  :language
            String  :isbn
            Integer :page_count
            String  :description
            String  :genre
            DateTime :updated_at, default: Sequel::CURRENT_TIMESTAMP

            unique :resource_id
          end
        end
      },
      {
        version: 3,
        table:   nil,
        up:      lambda do |db|
          db.alter_table(:ebook_meta) do
            add_column :cover_image, :blob
            add_column :cover_mime,  String
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
        r.get("meta")      { get_meta(resource_id) }
        r.post("meta")     { update_meta(resource_id, r) }
        r.get("stream")    { stream_ebook(r, resource_id) }
        r.get("cover")     { stream_cover(r, resource_id) }
        r.post("cover")    { store_cover(r, resource_id) }
      end

      r.get { Resource.where(plugin: "ebook", active: true).map(&:to_api_h) }
    end
  end

  private

  def stream_ebook(r, resource_id)
    resource = Resource.first(id: resource_id, plugin: "ebook")
    r.halt(404, { error: "Not found" }) unless resource

    path = resource.locations.map { |l| l["path"] }.find { |p| ::File.exist?(p) }
    r.halt(404, { error: "No accessible file for this resource" }) unless path

    ext  = ::File.extname(path).downcase.delete(".")
    mime = case ext
           when "epub"  then "application/epub+zip"
           when "pdf"   then "application/pdf"
           when "mobi"  then "application/x-mobipocket-ebook"
           when "azw3"  then "application/vnd.amazon.ebook"
           when "txt"   then "text/plain"
           else              "application/octet-stream"
           end

    throw :halt, [200, {
      "Content-Type"        => mime,
      "Content-Length"      => ::File.size(path).to_s,
      "Content-Disposition" => "inline; filename=\"#{::File.basename(path)}\"",
      "Cache-Control"       => "private, max-age=3600"
    }, ::File.open(path, "rb")]
  end

  def stream_cover(r, resource_id)
    resource = Resource.first(id: resource_id, plugin: "ebook")
    r.halt(404, { error: "Not found" }) unless resource

    # Serve from DB blob first (fastest, device-independent)
    meta_row = DB.connection[:ebook_meta].where(resource_id: resource_id).first
    if meta_row && meta_row[:cover_image]
      data = meta_row[:cover_image].to_s
      mime = meta_row[:cover_mime] || "image/jpeg"
      throw :halt, [200, {
        "Content-Type"   => mime,
        "Content-Length" => data.bytesize.to_s,
        "Cache-Control"  => "private, max-age=86400"
      }, [data]]
    end

    # Fall back to on-demand extraction from epub file
    epub_path = resource.locations.map { |l| l["path"] }.find { |p| ::File.exist?(p) }
    r.halt(404, { error: "No cover found" }) unless epub_path&.end_with?(".epub")

    cover_data, mime = extract_epub_cover(epub_path)
    r.halt(404, { error: "No cover found" }) unless cover_data

    throw :halt, [200, {
      "Content-Type"   => mime,
      "Content-Length" => cover_data.bytesize.to_s,
      "Cache-Control"  => "private, max-age=86400"
    }, [cover_data]]
  end

  def store_cover(r, resource_id)
    resource = Resource.first(id: resource_id, plugin: "ebook")
    r.halt(404, { error: "Not found" }) unless resource

    mime = r.env["CONTENT_TYPE"]&.split(";")&.first&.strip || "image/jpeg"
    data = r.env["rack.input"].read
    r.halt(400, { error: "No image data" }) if data.nil? || data.empty?

    blob = Sequel.blob(data)
    DB.connection[:ebook_meta].insert_conflict(
      target: :resource_id,
      update: { cover_image: blob, cover_mime: mime, updated_at: Sequel::CURRENT_TIMESTAMP }
    ).insert(resource_id: resource_id, cover_image: blob, cover_mime: mime)

    { ok: true }
  end

  # Extracts the cover image from an epub (zip) using the system unzip binary.
  # Returns [image_bytes, mime_type] or nil if not found.
  def extract_epub_cover(epub_path)
    # Step 1: find the OPF file path from META-INF/container.xml
    container_xml = read_zip_entry(epub_path, "META-INF/container.xml")
    return nil unless container_xml

    opf_path = container_xml[/full-path="([^"]+\.opf)"/, 1]
    return nil unless opf_path

    # Step 2: parse the OPF to find the cover image
    opf_xml = read_zip_entry(epub_path, opf_path)
    return nil unless opf_xml

    # Strategy A: item with id="cover-image" or properties="cover-image"
    cover_href = opf_xml[/properties="cover-image"[^>]*href="([^"]+)"/, 1] ||
                 opf_xml[/<item[^>]+id="cover[-_]image"[^>]+href="([^"]+)"/, 1] ||
                 opf_xml[/<item[^>]+href="([^"]+)"[^>]+id="cover[-_]image"/, 1]

    # Strategy B: meta name="cover" → find item by id
    unless cover_href
      cover_id = opf_xml[/<meta[^>]+name="cover"[^>]+content="([^"]+)"/, 1]
      cover_href = opf_xml[/<item[^>]+id="#{Regexp.escape(cover_id)}"[^>]+href="([^"]+)"/, 1] if cover_id
    end

    return nil unless cover_href

    # Resolve relative path against OPF directory
    opf_dir   = ::File.dirname(opf_path)
    full_href = opf_dir == "." ? cover_href : "#{opf_dir}/#{cover_href}"

    ext  = ::File.extname(full_href).downcase.delete(".")
    mime = case ext
           when "jpg", "jpeg" then "image/jpeg"
           when "png"         then "image/png"
           when "webp"        then "image/webp"
           when "gif"         then "image/gif"
           else                    "image/jpeg"
           end

    data = read_zip_entry(epub_path, full_href)
    data ? [data, mime] : nil
  end

  # Reads a single entry from a zip file using the system unzip binary.
  def read_zip_entry(zip_path, entry_name)
    IO.popen(["unzip", "-p", zip_path, entry_name], "rb", err: :close) do |f|
      data = f.read
      data.empty? ? nil : data
    end
  rescue StandardError
    nil
  end

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

  EBOOK_META_FIELDS = %w[author illustrator publisher published_date language isbn page_count description genre].freeze

  def get_meta(resource_id)
    DB.connection[:ebook_meta].where(resource_id: resource_id).first || {}
  end

  def update_meta(resource_id, r)
    attrs = EBOOK_META_FIELDS.each_with_object({}) { |k, h| h[k.to_sym] = r.POST[k] if r.POST.key?(k) }
    DB.connection[:ebook_meta].insert_conflict(
      target: :resource_id,
      update: attrs.merge(updated_at: Sequel::CURRENT_TIMESTAMP)
    ).insert(attrs.merge(resource_id: resource_id))
    { ok: true }
  end
end
