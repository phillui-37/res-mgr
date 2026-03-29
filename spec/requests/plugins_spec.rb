# frozen_string_literal: true

require "spec_helper"

RSpec.describe "Plugin endpoints", type: :request do
  describe "GET /plugins" do
    context "without authentication" do
      it "returns 401" do
        get "/plugins"
        expect(last_response.status).to eq(401)
      end
    end

    context "with authentication" do
      it "returns 200" do
        get_authed "/plugins"
        expect(last_response.status).to eq(200)
      end

      it "returns an array of plugins" do
        get_authed "/plugins"
        expect(json_body).to be_an(Array)
      end

      it "includes name, version, capabilities for each plugin" do
        get_authed "/plugins"
        json_body.each do |plugin|
          expect(plugin.keys).to include("name", "version", "capabilities")
        end
      end

      it "includes the ebook plugin" do
        get_authed "/plugins"
        names = json_body.map { |p| p["name"] }
        expect(names).to include("ebook")
      end
    end
  end

  describe "GET /plugins/:name" do
    context "for an existing plugin" do
      it "returns 200" do
        get_authed "/plugins/ebook"
        expect(last_response.status).to eq(200)
      end

      it "returns the plugin details" do
        get_authed "/plugins/ebook"
        expect(json_body["name"]).to eq("ebook")
        expect(json_body["version"]).to eq("1.0.0")
      end
    end

    context "for a nonexistent plugin" do
      it "returns 404" do
        get_authed "/plugins/ghost_plugin"
        expect(last_response.status).to eq(404)
      end

      it "returns an error message" do
        get_authed "/plugins/ghost_plugin"
        expect(json_body["error"]).to include("not found")
      end
    end
  end

  describe "POST /plugins/:name/reload" do
    context "for an existing file-based plugin" do
      it "returns 200 and the reloaded plugin version" do
        # Stub the reload to avoid actual file operations in the test
        plugin_double = instance_double(BasePlugin,
                                        name: "ebook", version: "1.0.0",
                                        schema_migrations: [], on_load: nil)
        allow(PluginLoader::File).to receive(:reload_file).and_return(plugin_double)

        post_json "/plugins/ebook/reload", {}
        expect(last_response.status).to eq(200)
        expect(json_body["reloaded"]).to eq("ebook")
      end
    end

    context "for a nonexistent plugin" do
      it "returns 404" do
        post_json "/plugins/ghost/reload", {}
        expect(last_response.status).to eq(404)
      end
    end
  end
end
