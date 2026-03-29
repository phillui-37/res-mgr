# frozen_string_literal: true

require "spec_helper"

RSpec.describe HealthController do
  describe ".status" do
    subject(:result) { described_class.status }

    it "returns a hash with required keys" do
      expect(result.keys).to contain_exactly(:status, :database, :plugins, :uptime)
    end

    context "when the database is healthy" do
      it "sets status to 'ok'" do
        expect(result[:status]).to eq("ok")
      end

      it "returns database.ok = true" do
        expect(result[:database][:ok]).to be true
      end

      it "returns the adapter scheme" do
        expect(result[:database][:adapter]).not_to be_nil
      end
    end

    context "when the database is unreachable" do
      before do
        allow(DB.connection).to receive(:test_connection).and_raise(StandardError, "connection refused")
      end

      it "sets status to 'degraded'" do
        expect(result[:status]).to eq("degraded")
      end

      it "sets database.ok to false" do
        expect(result[:database][:ok]).to be false
      end

      it "includes the error message" do
        expect(result[:database][:error]).to eq("connection refused")
      end
    end

    describe "plugins hash" do
      it "includes a count" do
        expect(result[:plugins][:count]).to be_a(Integer)
      end

      it "includes a plugins array" do
        expect(result[:plugins][:plugins]).to be_an(Array)
      end

      it "each plugin entry has name, version, capabilities" do
        result[:plugins][:plugins].each do |p|
          expect(p.keys).to include(:name, :version, :capabilities)
        end
      end
    end

    describe "uptime" do
      it "is a non-negative number" do
        expect(result[:uptime]).to be >= 0
      end

      it "grows over time" do
        first  = described_class.status[:uptime]
        sleep 0.01
        second = described_class.status[:uptime]
        expect(second).to be > first
      end
    end
  end
end
