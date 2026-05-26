# ─── lazynet Makefile ─────────────────────────────────────────────────────────
.DEFAULT_GOAL := help
.PHONY: help install uninstall update dev run deps clean link unlink

BINARY      := /usr/local/bin/lazynet
DEST_DIR    := $(HOME)/.local/share/lazynet
SRC         := $(abspath index.js)

help:
	@printf "\n"
	@printf "  \033[1;36m◈ lazynet\033[0m  — .NET Solution TUI\n"
	@printf "\n"
	@printf "  \033[33mUsage:\033[0m  make \033[36m<target>\033[0m\n"
	@printf "\n"
	@printf "  \033[36m%-14s\033[0m  %s\n" \
		deps       "install node dependencies (in source dir)" \
		run        "run directly from source" \
		dev        "run in dev mode (full npm install + run)" \
		install    "copy to ~/.local/share/lazynet + link $(BINARY)" \
		update     "re-copy source → installed location (re-build)" \
		uninstall  "remove binary + installed files" \
		link       "npm link  (alternative, symlink-based)" \
		unlink     "npm unlink" \
		clean      "delete node_modules from source dir"
	@printf "\n"
	@printf "  \033[2mAfter install, source directory can be safely deleted.\033[0m\n"
	@printf "\n"

# ── Development ────────────────────────────────────────────────────────────────

deps:
	@printf "  Installing dependencies…\n"
	@npm install --omit=dev
	@printf "  \033[32m✔ Done\033[0m\n"

dev:
	@npm install
	@node index.js

run:
	@node index.js

# ── Install / Update ───────────────────────────────────────────────────────────

install:
	@printf "  \033[1mCopying files\033[0m → \033[36m$(DEST_DIR)\033[0m\n"
	@mkdir -p $(DEST_DIR)/src/core $(DEST_DIR)/src/ui
	@cp index.js package.json $(DEST_DIR)/
	@cp -r src/core $(DEST_DIR)/src/
	@cp -r src/ui   $(DEST_DIR)/src/
	@cp src/state.js src/keybindings.js $(DEST_DIR)/src/ 2>/dev/null || true
	@printf "  Installing production dependencies…\n"
	@cd $(DEST_DIR) && npm install --omit=dev --silent
	@chmod +x $(DEST_DIR)/index.js
	@printf "  \033[1mLinking binary\033[0m → \033[36m$(BINARY)\033[0m\n"
	@if [ -w "$$(dirname $(BINARY))" ]; then \
		ln -sf $(DEST_DIR)/index.js $(BINARY); \
	else \
		sudo ln -sf $(DEST_DIR)/index.js $(BINARY); \
	fi
	@printf "  \033[32m✔ Installed\033[0m — run: \033[1mlazynet\033[0m\n"
	@printf "  \033[2m(source directory can now be deleted)\033[0m\n"

update:
	@if [ ! -d "$(DEST_DIR)" ]; then \
		printf "  \033[31m✘ Not installed yet — run: make install\033[0m\n"; exit 1; \
	fi
	@printf "  \033[1mUpdating\033[0m $(DEST_DIR)…\n"
	@cp index.js package.json $(DEST_DIR)/
	@cp -r src/core $(DEST_DIR)/src/
	@cp -r src/ui   $(DEST_DIR)/src/
	@cp src/state.js src/keybindings.js $(DEST_DIR)/src/ 2>/dev/null || true
	@cd $(DEST_DIR) && npm install --omit=dev --silent
	@printf "  \033[32m✔ Updated\033[0m\n"

# ── Uninstall ──────────────────────────────────────────────────────────────────

uninstall:
	@if [ -f "$(BINARY)" ] || [ -L "$(BINARY)" ]; then \
		if [ -w "$$(dirname $(BINARY))" ]; then rm -f $(BINARY); \
		else sudo rm -f $(BINARY); fi; \
		printf "  \033[32m✔ Removed\033[0m $(BINARY)\n"; \
	fi
	@if [ -d "$(DEST_DIR)" ]; then \
		rm -rf $(DEST_DIR); \
		printf "  \033[32m✔ Removed\033[0m $(DEST_DIR)\n"; \
	fi

# ── npm link (alternative) ────────────────────────────────────────────────────

link:
	@npm link
	@printf "  \033[32m✔ Linked globally\033[0m\n"

unlink:
	@npm unlink
	@printf "  \033[32m✔ Unlinked\033[0m\n"

# ── Clean source ───────────────────────────────────────────────────────────────

clean:
	@rm -rf node_modules
	@printf "  \033[32m✔ node_modules removed\033[0m\n"
