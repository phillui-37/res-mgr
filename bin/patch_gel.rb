#!/usr/bin/env ruby
# bin/patch_gel.rb — applies Ruby 3.4 compatibility patches to gel 0.3.0
# Run once after `gem install gel`. Idempotent.
# frozen_string_literal: true

require "rbconfig"

gel_base = Gem.find_files("gel/catalog/common.rb").first&.then do |f|
  File.dirname(File.dirname(f))
end

unless gel_base
  warn "gel not found in gem path. Run `gem install gel` first."
  exit 1
end

patches = {
  "#{gel_base}/catalog/compact_index.rb" => [
    ["def initialize(*)\n    super", "def initialize(*args, **kwargs)\n    super(*args, **kwargs)"]
  ],
  "#{gel_base}/catalog/legacy_index.rb" => [
    ["def initialize(*)\n    super", "def initialize(*args, **kwargs)\n    super(*args, **kwargs)"]
  ],
  "#{gel_base}/store.rb" => [
    ['raise "already installed"', "next"]
  ]
}

patches.each do |path, replacements|
  next unless File.exist?(path)

  content = File.read(path)
  changed = false

  replacements.each do |from, to|
    next unless content.include?(from)

    content.gsub!(from, to)
    changed = true
  end

  if changed
    File.write(path, content)
    puts "Patched #{path}"
  else
    puts "Already patched: #{path}"
  end
end

puts "gel patch complete."
