#!/usr/bin/env ruby
# bin/install_stdlib_gems.rb
# Copies Ruby 4.x-removed stdlib gems (pstore, ostruct) into rubylibdir
# so they are requireable before RubyGems activation (needed by gel).
# frozen_string_literal: true

require "rbconfig"
require "rubygems"
require "fileutils"

%w[pstore ostruct logger].each do |name|
  spec = Gem::Specification.find_by_name(name)
  lib_dir = File.join(spec.full_gem_path, "lib")
  Dir[File.join(lib_dir, "**", "*.rb")].each do |src|
    rel = src.sub(lib_dir + "/", "")
    dst = File.join(RbConfig::CONFIG["rubylibdir"], rel)
    FileUtils.mkdir_p(File.dirname(dst))
    File.write(dst, File.read(src))
    puts "Installed #{dst}"
  end
end
