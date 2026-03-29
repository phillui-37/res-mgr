# frozen_string_literal: true

require "spec_helper"

RSpec.describe ControllerHelpers do
  # Build a minimal host class to verify the module behaviour.
  let(:host_class) do
    Class.new do
      extend ControllerHelpers
    end
  end

  describe ".halt!" do
    it "throws :halt with the given status and a JSON error body" do
      caught = catch(:halt) { host_class.halt!(404, "Not found") }
      status, headers, body = caught
      expect(status).to eq(404)
      expect(headers["content-type"]).to eq("application/json")
      parsed = Oj.load(body.first, mode: :compat)
      expect(parsed["error"]).to eq("Not found")
    end

    it "throws :halt with a 422 status" do
      caught = catch(:halt) { host_class.halt!(422, "Invalid input") }
      expect(caught[0]).to eq(422)
    end

    it "throws :halt with a 500 status" do
      caught = catch(:halt) { host_class.halt!(500, "Internal error") }
      expect(caught[0]).to eq(500)
    end
  end
end
