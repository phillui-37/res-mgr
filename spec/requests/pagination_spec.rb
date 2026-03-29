# frozen_string_literal: true

require "spec_helper"

RSpec.describe "GET /resources pagination", type: :request do
  before do
    6.times do |i|
      post_json "/resources",
                { name: "item_#{i}.epub", type: "ebook", plugin: "ebook" }
    end
  end

  it "defaults to returning all resources when no pagination params given (up to 50)" do
    get_authed "/resources"
    expect(last_response.status).to eq(200)
    expect(json_body.size).to eq(6)
  end

  it "respects per_page parameter" do
    get_authed "/resources", { "per_page" => "2" }
    expect(last_response.status).to eq(200)
    expect(json_body.size).to eq(2)
  end

  it "respects page parameter" do
    get_authed "/resources", { "per_page" => "2", "page" => "2" }
    expect(last_response.status).to eq(200)
    expect(json_body.size).to eq(2)
    page1_ids = begin
      get_authed "/resources", { "per_page" => "2", "page" => "1" }
      json_body.map { |r| r["id"] }
    end
    page2_ids = begin
      get_authed "/resources", { "per_page" => "2", "page" => "2" }
      json_body.map { |r| r["id"] }
    end
    expect(page1_ids & page2_ids).to be_empty
  end

  it "returns X-Total-Count header" do
    get_authed "/resources"
    expect(last_response.headers["X-Total-Count"].to_i).to eq(6)
  end

  it "returns X-Page and X-Per-Page headers" do
    get_authed "/resources", { "per_page" => "3", "page" => "1" }
    expect(last_response.headers["X-Page"].to_i).to eq(1)
    expect(last_response.headers["X-Per-Page"].to_i).to eq(3)
  end

  it "caps per_page at 200" do
    get_authed "/resources", { "per_page" => "999" }
    expect(last_response.headers["X-Per-Page"].to_i).to eq(200)
  end

  it "uses page=1 for invalid page values" do
    get_authed "/resources", { "page" => "-1" }
    expect(last_response.headers["X-Page"].to_i).to eq(1)
  end
end
