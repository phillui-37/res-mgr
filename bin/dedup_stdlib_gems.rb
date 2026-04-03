#!/usr/bin/env ruby
# bin/dedup_stdlib_gems.rb
# After `gel install`, the stdlib shims copied into rubylibdir by
# install_stdlib_gems.rb conflict with the gel-managed copies, producing
# "already initialized constant" warnings.
#
# Fix: replace each rubylibdir copy with a symlink to the gel-managed version
# so Ruby loads only one path and records it once in $LOADED_FEATURES.
# frozen_string_literal: true

require "rbconfig"
require "fileutils"

GEL_GEMS_DIR = File.join(Dir.home, ".local", "gel", "ruby", "gems")

%w[pstore ostruct logger].each do |name|
  # Find the gel-managed gem directory (e.g. /root/.local/gel/ruby/gems/logger-1.7.0)
  gel_dirs = Dir.glob(File.join(GEL_GEMS_DIR, "#{name}-*"))
  gel_dir = gel_dirs.max # pick highest version if multiple
  unless gel_dir
    puts "Skipping #{name} — not found in gel store"
    next
  end

  gel_lib = File.join(gel_dir, "lib")
  rubylibdir = RbConfig::CONFIG["rubylibdir"]

  # Find all .rb files that were copied into rubylibdir by install_stdlib_gems.rb
  Dir[File.join(gel_lib, "**", "*.rb")].each do |gel_src|
    rel = gel_src.sub(gel_lib + "/", "")
    stdlib_copy = File.join(rubylibdir, rel)
    next unless File.exist?(stdlib_copy) && !File.symlink?(stdlib_copy)

    FileUtils.rm(stdlib_copy)
    FileUtils.ln_s(gel_src, stdlib_copy)
    puts "Linked #{stdlib_copy} -> #{gel_src}"
  end
end
