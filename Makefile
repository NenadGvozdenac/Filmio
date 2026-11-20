# Filmio
#   make start    install dependencies (if needed) and run the desktop app
#   make exe      build the Windows installer (desktop/dist/Filmio-Setup-<version>.exe)
#   make help     list all targets

DESKTOP := desktop

# VS Code terminals set this, which makes Electron behave like plain Node.
unexport ELECTRON_RUN_AS_NODE

.PHONY: help install start exe clean

help:
	@echo "make install  - install desktop dependencies"
	@echo "make start    - run the desktop app"
	@echo "make exe      - build the Windows installer into desktop/dist"
	@echo "make clean    - remove node_modules and build output"

# Reinstall only when package.json changed. The timestamp is refreshed afterwards because
# "npm install" does not touch node_modules when nothing changed.
$(DESKTOP)/node_modules: $(DESKTOP)/package.json
	cd $(DESKTOP) && npm install
	node -e "const fs=require('fs');const t=new Date();fs.utimesSync('$(DESKTOP)/node_modules',t,t)"

install: $(DESKTOP)/node_modules

start: install
	cd $(DESKTOP) && npm start

exe: install
	cd $(DESKTOP) && npm run dist

clean:
	cd $(DESKTOP) && npx --yes rimraf node_modules dist
