# Use the project's Ruby runtime (Net::HTTP DNS pinning is required).
# Rails and database credentials are unnecessary.
# Writes an additive candidate catalogue and audit for review. Never writes the DB.
require "optparse"
require_relative "../app/services/shop_color_variants"

options = {}
OptionParser.new do |parser|
  parser.banner = "Usage: ruby backend/script/refresh_shop_color_variants.rb --input FILE --output FILE --audit FILE [--limit N]"
  parser.on("--input FILE") { |value| options[:input] = value }
  parser.on("--output FILE") { |value| options[:output] = value }
  parser.on("--audit FILE") { |value| options[:audit] = value }
  parser.on("--limit N", Integer) { |value| options[:limit] = value }
end.parse!
abort "--input, --output and --audit are required" unless %i[input output audit].all? { |key| options[key] }
abort "Output paths must differ from the input and each other" unless options.values_at(:input, :output, :audit).map { |path| File.expand_path(path) }.uniq.size == 3
abort "--limit must be positive" if options[:limit] && options[:limit] <= 0

result = ShopColorVariants.call(JSON.parse(File.read(options.fetch(:input))), limit: options[:limit])
File.write(options.fetch(:output), JSON.pretty_generate(result.fetch("catalogue")) + "\n")
File.write(options.fetch(:audit), JSON.pretty_generate(result.fetch("audit")) + "\n")
puts JSON.generate({ details: result.fetch("catalogue").fetch("details").size, statuses: result.fetch("audit").group_by { |entry| entry.fetch("status") }.transform_values(&:size) })
