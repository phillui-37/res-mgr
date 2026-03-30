# syntax=docker/dockerfile:1

# ---- base: OS + rbenv + Ruby ----
FROM ubuntu:24.04 AS base

ENV DEBIAN_FRONTEND=noninteractive \
    RBENV_ROOT=/usr/local/rbenv \
    PATH=/usr/local/rbenv/bin:/usr/local/rbenv/shims:$PATH

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential curl git pkg-config libssl-dev libreadline-dev zlib1g-dev \
      libffi-dev libyaml-dev libgdbm-dev libncurses5-dev \
      libpq-dev libsqlite3-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install rbenv (works identically to rvm for version pinning via .ruby-version)
RUN git clone --depth=1 https://github.com/rbenv/rbenv.git $RBENV_ROOT \
 && git clone --depth=1 https://github.com/rbenv/ruby-build.git $RBENV_ROOT/plugins/ruby-build \
 && rbenv init -

ARG RUBY_VERSION=4.0.2
RUN rbenv install "$RUBY_VERSION" \
 && rbenv global "$RUBY_VERSION" \
 && rbenv rehash

# Ruby 4.x removed some former stdlib libs (e.g. pstore, ostruct) that gel
# requires before RubyGems activation — install them as gems then copy into
# rubylibdir so they are always requireable without gem activation.
RUN gem install pstore ostruct logger gel --no-document
COPY bin/install_stdlib_gems.rb /tmp/install_stdlib_gems.rb
RUN ruby /tmp/install_stdlib_gems.rb
COPY bin/patch_gel.rb /tmp/patch_gel.rb
RUN ruby /tmp/patch_gel.rb && rbenv rehash

# ---- deps: install gems ----
FROM base AS deps

WORKDIR /app
COPY Gemfile Gemfile.lock ./
RUN gel install && rbenv rehash

# ---- final ----
FROM deps AS app

WORKDIR /app
COPY . .

RUN mkdir -p db/migrations

EXPOSE 3000

ENV APP_PORT=3000 \
    APP_HOST=0.0.0.0 \
    DATABASE_URL=sqlite://db/res_mgr.sqlite3 \
    LOG_LEVEL=info

CMD ["gel", "exec", "puma", "-C", "config/puma.rb"]
